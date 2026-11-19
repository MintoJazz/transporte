'use strict';
/**
 * SERVIDOR DO CHAT — leia de cima para baixo.
 *
 *   PARTE 1  A agenda: quem está online
 *   PARTE 2  Abrir as portas: TCP 9990 (cadastro e lista) e UDP 9990 (grupo)
 *   PARTE 3  Cada cliente que conecta: cadastro, lista e saída
 *   PARTE 4  O grupo: um datagrama entra, uma cópia sai para cada contato
 *
 * Uso: node servidor.js        (ou: npm run servidor)
 */

const net = require('net');
const dgram = require('dgram');
const { quandoChegarMensagem, enviar, paraDatagrama, deDatagrama, limparIp } = require('./apoio/mensagens');
const { criarLog } = require('./apoio/log');
const { caixa, erro } = require('./apoio/visual');
const { ipsDaRede } = require('./apoio/ip');

const PORTA = 9990;
const log = criarLog('SERVIDOR');   // escreve na tela e em logs/servidor/


// =============================================================================
// PARTE 1 — A AGENDA: quem está online
// =============================================================================

// nick → { nick, ip, portaTcp, portaUdp, socket }
const agenda = new Map();

/** Regras do cadastro. Devolve o texto do erro, ou null se puder cadastrar. */
function validarCadastro({ nick, portaTcp, portaUdp }) {
  const portaOk = (p) => Number.isInteger(p) && p > 0 && p < 65536;
  if (typeof nick !== 'string' || !/^\S{1,20}$/.test(nick) || !portaOk(portaTcp) || !portaOk(portaUdp)) {
    return 'nick (1-20 caracteres, sem espaços) e portas válidas são obrigatórios';
  }
  if (agenda.has(nick)) return `o nick "${nick}" já está em uso`;
  return null;
}

/** A agenda que vai para os clientes: sem o socket. */
function agendaPublica() {
  return [...agenda.values()].map(({ nick, ip, portaTcp, portaUdp }) => ({ nick, ip, portaTcp, portaUdp }));
}


// =============================================================================
// PARTE 2 — ABRIR AS PORTAS
// =============================================================================

const servidorTcp = net.createServer(aoConectar);   // quando alguém conectar      → aoConectar (PARTE 3)
const udp = dgram.createSocket('udp4');
udp.on('message', aoReceberDatagrama);              // quando chegar um datagrama  → aoReceberDatagrama (PARTE 4)

servidorTcp.on('error', falharAoAbrir);
udp.on('error', falharAoAbrir);

servidorTcp.listen(PORTA, () => {
  log('listen', `TCP escutando em 0.0.0.0:${PORTA}  (socket + bind + listen)`);
});

udp.bind(PORTA, () => {
  log('bind', `UDP vinculado a 0.0.0.0:${PORTA}  (socket + bind; UDP não tem listen/accept)`);
  console.log(caixa('SERVIDOR NO AR', [
    `TCP ${PORTA}: cadastro (nick) e lista de contatos`,
    `UDP ${PORTA}: grupo (broadcast para todos)`,
    'Logs: logs/servidor/',
    '',
    ...linhasDosIps(),
  ]));
});

/** Linhas da caixa com o IP deste servidor e o comando para os clientes. */
function linhasDosIps() {
  const ips = ipsDaRede();
  if (ips.length === 0) return ['IP na rede: nenhum (só local: 127.0.0.1)'];
  return [
    ...ips.map(({ placa, ip }) => `IP na rede: ${ip}  (${placa})`),
    `Clientes em outro computador: npm run ana -- ${ips[0].ip}`,
  ];
}

function falharAoAbrir(e) {
  console.error(erro(e.code === 'EADDRINUSE' ? `porta ${PORTA} já está em uso.` : `falha: ${e.message}`));
  process.exit(1);
}


// =============================================================================
// PARTE 3 — CADA CLIENTE QUE CONECTA
// Esta função roda uma vez para cada cliente. Tudo dentro dela é daquele cliente.
// =============================================================================

function aoConectar(socket) {
  const ip = limparIp(socket.remoteAddress);
  const origem = `${ip}:${socket.remotePort}`;
  let nick = null;                                   // fica preenchido depois do cadastro

  log('accept', `nova conexão de ${origem} (um socket só para este cliente)`);

  // Daqui até o "AGORA", só AVISAMOS o que fazer quando algo acontecer:
  quandoChegarMensagem(socket, (msg) => {            // quando o cliente mandar uma mensagem
    if (msg.tipo === 'registro') registrar(msg);
    else if (msg.tipo === 'listar') enviarLista();
    else if (msg.tipo === 'sair') pediuParaSair();
  });
  socket.on('close', saiu);                          // quando a conexão fechar (sair, queda, kill)
  socket.on('error', (e) => log('erro', `${origem}: ${e.code || e.message}`));

  // AGORA: pedimos o nick. A resposta chega depois, no "quando o cliente mandar".
  log('send', `pedir_nick → ${origem}`);
  enviar(socket, { tipo: 'pedir_nick' });

  // ---------------------------------------------------------------------------

  function registrar(msg) {
    const pedido = { nick: msg.nick, portaTcp: Number(msg.portaTcp), portaUdp: Number(msg.portaUdp) };
    const problema = nick ? 'você já está cadastrado' : validarCadastro(pedido);
    if (problema) {
      log('recv', `registro recusado: ${problema}`);
      return enviar(socket, { tipo: 'registro_erro', texto: problema });
    }
    nick = pedido.nick;
    agenda.set(nick, { ...pedido, ip, socket });     // o IP vem do socket, não do cliente
    log('recv', `registro: ${nick} (TCP direto :${pedido.portaTcp}, UDP :${pedido.portaUdp}) — ${agenda.size} contato(s) online`);
    enviar(socket, { tipo: 'registro_ok', nick });
  }

  function enviarLista() {
    if (!nick) return enviar(socket, { tipo: 'erro', texto: 'cadastre-se primeiro' });
    log('recv', `${nick} pediu a lista de contatos`);
    log('send', `lista com ${agenda.size} contato(s)`);
    enviar(socket, { tipo: 'lista', contatos: agendaPublica() });
  }

  function pediuParaSair() {
    log('recv', `${nick || origem} pediu para sair`);
    socket.end();                                    // fecha; o "close" acima cuida do resto
  }

  function saiu() {
    const doCliente = nick && agenda.get(nick);
    if (doCliente && doCliente.socket === socket) {
      agenda.delete(nick);
      log('close', `${nick} saiu — removido da lista (${agenda.size} contato(s) online)`);
    } else {
      log('close', `conexão ${origem} encerrada`);
    }
  }
}


// =============================================================================
// PARTE 4 — O GRUPO (UDP)
// Um datagrama chega do cliente; o servidor manda uma cópia para cada contato.
// =============================================================================

function aoReceberDatagrama(bytes, remetente) {
  const msg = deDatagrama(bytes);
  if (!msg || msg.tipo !== 'msg_grupo' || !agenda.has(msg.de)) {
    log('aviso', `datagrama de ${remetente.address}:${remetente.port} ignorado: remetente não cadastrado ou mensagem inválida`);
    return;
  }

  const texto = String(msg.texto).slice(0, 500);
  log('recvfrom', `datagrama de ${msg.de}: "${texto}"`);

  const copia = paraDatagrama({ tipo: 'msg_grupo', de: msg.de, texto });
  for (const contato of agenda.values()) {
    udp.send(copia, contato.portaUdp, contato.ip);
    log('sendto', `→ ${contato.nick} (${contato.ip}:${contato.portaUdp})`);
  }
}
