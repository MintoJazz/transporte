'use strict';
/**
 * CLIENTE DO CHAT — leia de cima para baixo.
 *
 *   PARTE 1  Quem sou eu e a tela
 *   PARTE 2  Abrir as minhas portas: TCP (receber privado) e UDP (receber o grupo)
 *   PARTE 3  Conversa com o servidor: cadastro, lista e queda do servidor
 *   PARTE 4  Conversa privada: ligar direto para outro cliente (TCP)
 *   PARTE 5  Grupo: mandar um datagrama para o servidor (UDP)
 *   PARTE 6  Os comandos que o usuário digita
 *
 * Uso: node cliente.js <nick> <portaTcp> <portaUdp> [ipServidor] [-v]
 *      (-v mostra as operações de socket na tela)
 */

const net = require('net');
const dgram = require('dgram');
const readline = require('readline');
const { quandoChegarMensagem, enviar, paraDatagrama, deDatagrama, limparIp } = require('./apoio/mensagens');
const { criarLog } = require('./apoio/log');
const { caixa, tabelaContatos, mensagemChat, erro, aviso } = require('./apoio/visual');


// =============================================================================
// PARTE 1 — QUEM SOU EU E A TELA
// =============================================================================

const verbose = process.argv.includes('-v');
const [nick, argTcp, argUdp, argIp] = process.argv.slice(2).filter((a) => a !== '-v');
if (!nick || !argTcp || !argUdp) {
  console.log('Uso: node cliente.js <nick> <portaTcp> <portaUdp> [ipServidor] [-v]');
  console.log('Ex.: node cliente.js Ana 5001 6001 -v');
  process.exit(1);
}

const portaTcp = Number(argTcp);           // onde EU recebo conversas privadas
const portaUdp = Number(argUdp);           // onde EU recebo o grupo
const IP_SERVIDOR = argIp || '127.0.0.1';
const PORTA_SERVIDOR = 9990;
const AJUDA = 'Comandos: /lista | /privado <nick> <mensagem> | /grupo <mensagem> | /sair';

const teclado = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${nick}> ` });

/** Imprime na tela sem bagunçar o que o usuário está digitando. */
function mostrar(texto) {
  readline.cursorTo(process.stdout, 0);
  readline.clearLine(process.stdout, 0);
  console.log(texto);
  teclado.prompt(true);
}

const log = criarLog(nick, { tela: verbose ? mostrar : null });   // sempre grava em logs/<nick>/

function falharAoEntrar(texto) {
  console.error(erro(`não foi possível entrar: ${texto}`));
  process.exit(1);
}


// =============================================================================
// PARTE 2 — ABRIR AS MINHAS PORTAS
// =============================================================================

// Minha "recepção" própria: outros clientes ligam aqui para conversar comigo.
const recepcaoPrivada = net.createServer(aoReceberConversa);   // quando alguém ligar     → aoReceberConversa (PARTE 4)
recepcaoPrivada.on('error', (e) => falharAoEntrar(e.code === 'EADDRINUSE' ? `porta já está em uso (${e.message})` : e.message));
recepcaoPrivada.listen(portaTcp, () => {
  log('listen', `TCP direto escutando em :${portaTcp}  (para receber conversas ponto a ponto)`);
});

// Meu socket UDP: recebe as cópias do grupo e manda para o servidor.
const udp = dgram.createSocket('udp4');
udp.on('message', aoReceberGrupo);                             // quando chegar datagrama → aoReceberGrupo (PARTE 5)
udp.on('error', (e) => falharAoEntrar(e.code === 'EADDRINUSE' ? `porta já está em uso (${e.message})` : e.message));
udp.bind(portaUdp, () => {
  log('bind', `UDP vinculado a :${portaUdp}  (para receber o grupo)`);
});


// =============================================================================
// PARTE 3 — CONVERSA COM O SERVIDOR (TCP 9990)
// =============================================================================

const servidor = net.connect(PORTA_SERVIDOR, IP_SERVIDOR);   // liga para o servidor
let cadastrado = false;
let saindo = false;                      // fica true quando EU saio (para não confundir com queda do servidor)
let quandoChegarLista = mostrarLista;    // o que fazer com a próxima lista que chegar (ver PARTE 4)

servidor.on('connect', () => {
  log('connect', `conectado ao servidor ${IP_SERVIDOR}:${PORTA_SERVIDOR}`);
});

servidor.on('error', (e) => {
  if (!cadastrado) falharAoEntrar(e.code === 'ECONNREFUSED' ? `servidor offline em ${IP_SERVIDOR}:${PORTA_SERVIDOR}` : e.message);
});

quandoChegarMensagem(servidor, (msg) => {         // quando o servidor mandar uma mensagem
  if (msg.tipo === 'pedir_nick') {
    log('recv', 'pedir_nick');
    log('send', `registro: nick=${nick}, portaTcp=${portaTcp}, portaUdp=${portaUdp}`);
    enviar(servidor, { tipo: 'registro', nick, portaTcp, portaUdp });

  } else if (msg.tipo === 'registro_ok') {
    log('recv', 'registro_ok — cadastrado!');
    cadastrado = true;
    mostrarBoasVindas();

  } else if (msg.tipo === 'registro_erro') {
    log('erro', `cadastro recusado: ${msg.texto}`);
    falharAoEntrar(msg.texto);

  } else if (msg.tipo === 'lista') {
    const fazer = quandoChegarLista;
    quandoChegarLista = mostrarLista;              // a próxima volta a ser só "mostrar"
    fazer(msg.contatos);

  } else if (msg.tipo === 'erro') {
    mostrar(erro(msg.texto));
  }
});

servidor.on('close', () => {                      // quando a conexão com o servidor fechar
  if (saindo) return;                             // fui eu que saí: tudo certo
  log('close', 'o servidor encerrou a conexão');
  mostrar(aviso('O servidor encerrou a conexão. Saindo.'));
  process.exit(0);
});

function pedirLista() {
  log('send', 'listar');
  enviar(servidor, { tipo: 'listar' });
}


// =============================================================================
// PARTE 4 — CONVERSA PRIVADA (TCP direto, sem passar pelo servidor)
// =============================================================================

const conversasAbertas = new Map();   // nick → socket que EU abri para falar com ele

/** Alguém ligou na minha recepção privada. */
function aoReceberConversa(socket) {
  log('accept', `conversa direta recebida de ${limparIp(socket.remoteAddress)}:${socket.remotePort}`);
  socket.on('error', () => {});
  quandoChegarMensagem(socket, (msg) => {          // quando quem ligou mandar uma mensagem
    if (msg.tipo !== 'msg_direta') return;
    log('recv', `[TCP direto] ${msg.de}: ${msg.texto}`);
    mostrar(mensagemChat({ canal: 'direto', de: msg.de, texto: msg.texto }));
  });
}

/** /privado <destino> <texto> */
function falarPrivado(destino, texto) {
  if (destino === nick) return mostrar(erro('você não pode conversar consigo mesmo'));

  const aberta = conversasAbertas.get(destino);
  if (aberta && !aberta.destroyed) return mandarPrivado(aberta, destino, texto);   // já tenho linha com ele

  // Ainda não tenho linha: peço a lista e, QUANDO ela chegar, ligo para ele.
  quandoChegarLista = (contatos) => {
    const contato = contatos.find((c) => c.nick === destino);
    if (!contato) return mostrar(erro(`contato "${destino}" não está online`));
    ligarPara(contato, texto);
  };
  pedirLista();
}

function ligarPara(contato, texto) {
  log('connect', `abrindo TCP DIRETO para ${contato.nick} (${contato.ip}:${contato.portaTcp}) — sem passar pelo servidor`);
  const socket = net.connect(contato.portaTcp, contato.ip);
  socket.on('connect', () => {                     // quando a ligação completar
    conversasAbertas.set(contato.nick, socket);
    mandarPrivado(socket, contato.nick, texto);
  });
  socket.on('error', (e) => mostrar(erro(`não consegui conectar em ${contato.nick}: ${e.code || e.message}`)));
  socket.on('close', () => conversasAbertas.delete(contato.nick));   // quando cair: esquece
}

function mandarPrivado(socket, destino, texto) {
  log('send', `[TCP direto] → ${destino}: ${texto}`);
  enviar(socket, { tipo: 'msg_direta', de: nick, texto });
}


// =============================================================================
// PARTE 5 — GRUPO (UDP via servidor)
// =============================================================================

/** /grupo <texto>: UM datagrama para o servidor, que reenvia a todos. */
function falarNoGrupo(texto) {
  log('sendto', `[UDP grupo] datagrama para o servidor ${IP_SERVIDOR}:${PORTA_SERVIDOR}: ${texto}`);
  udp.send(paraDatagrama({ tipo: 'msg_grupo', de: nick, texto }), PORTA_SERVIDOR, IP_SERVIDOR);
}

/** Chegou a cópia do grupo que o servidor reenviou. */
function aoReceberGrupo(bytes) {
  const msg = deDatagrama(bytes);
  if (!msg || msg.tipo !== 'msg_grupo') return;
  log('recvfrom', `[UDP grupo] ${msg.de}: ${msg.texto}`);
  mostrar(mensagemChat({ canal: 'grupo', de: msg.de, texto: msg.texto }));
}


// =============================================================================
// PARTE 6 — OS COMANDOS QUE O USUÁRIO DIGITA
// =============================================================================

teclado.on('line', (entrada) => {                 // quando o usuário apertar ENTER
  const linha = entrada.trim();
  const [comando] = linha.split(' ', 1);
  const resto = linha.slice(comando.length).trim();

  if (comando === '/lista') {
    pedirLista();
  } else if (comando === '/privado') {
    const espaco = resto.indexOf(' ');
    if (espaco < 0) mostrar(erro('uso: /privado <nick> <mensagem>'));
    else falarPrivado(resto.slice(0, espaco), resto.slice(espaco + 1).trim());
  } else if (comando === '/grupo') {
    if (!resto) mostrar(erro('uso: /grupo <mensagem>'));
    else falarNoGrupo(resto);
  } else if (comando === '/sair') {
    sair();
  } else if (comando === '/ajuda') {
    mostrar(AJUDA);
  } else if (linha) {
    mostrar(aviso('Comando desconhecido. Digite /ajuda.'));
  }
  teclado.prompt();
});

teclado.on('close', sair);                        // Ctrl+C também é uma saída educada

function sair() {
  saindo = true;
  enviar(servidor, { tipo: 'sair' });             // avisa o servidor
  servidor.end();
  setTimeout(() => process.exit(0), 300);
}

function mostrarLista(contatos) {
  mostrar(tabelaContatos(contatos, nick));
}

function mostrarBoasVindas() {
  mostrar(caixa(`Conectado como ${nick}`, [
    `Servidor:   ${IP_SERVIDOR}:${PORTA_SERVIDOR}`,
    `TCP direto: porta ${portaTcp}  (recebe conversas privadas)`,
    `UDP grupo:  porta ${portaUdp}  (recebe o grupo)`,
    `Logs:       logs/${nick.toLowerCase()}/`,
    '',
    AJUDA,
  ], 'green'));
}
