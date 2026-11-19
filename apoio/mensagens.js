'use strict';
/**
 * APOIO — transformar mensagens em bytes e de volta.
 * Não precisa abrir este arquivo para entender o chat.
 *
 *   TCP: um JSON por linha. O "\n" marca onde cada mensagem termina,
 *        porque o TCP entrega um fluxo de bytes (pedaços de qualquer tamanho).
 *   UDP: um JSON por datagrama. O datagrama já é a mensagem inteira.
 */

/** Avisa: "quando chegar uma mensagem completa neste socket TCP, chame aoReceber(msg)". */
function quandoChegarMensagem(socket, aoReceber) {
  let guardado = '';                        // pedaço que chegou e ainda não tem "\n"
  socket.setEncoding('utf8');
  socket.on('data', (pedaco) => {
    guardado += pedaco;
    let fim;
    while ((fim = guardado.indexOf('\n')) !== -1) {
      const linha = guardado.slice(0, fim);
      guardado = guardado.slice(fim + 1);
      const msg = lerJson(linha);
      if (msg) aoReceber(msg);
    }
  });
}

/** Manda um objeto pelo socket TCP, como uma linha de JSON. */
function enviar(socket, msg) {
  if (!socket.destroyed) socket.write(JSON.stringify(msg) + '\n');
}

/** Objeto → bytes para mandar por UDP. */
function paraDatagrama(msg) {
  return Buffer.from(JSON.stringify(msg));
}

/** Bytes recebidos por UDP → objeto (ou null se não for JSON). */
function deDatagrama(bytes) {
  return lerJson(bytes.toString('utf8'));
}

function lerJson(texto) {
  try {
    const obj = JSON.parse(texto);
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

/** '::ffff:127.0.0.1' → '127.0.0.1' */
function limparIp(ip) {
  return String(ip || '').replace(/^::ffff:/, '');
}

module.exports = { quandoChegarMensagem, enviar, paraDatagrama, deDatagrama, limparIp };
