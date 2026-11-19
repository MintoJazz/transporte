'use strict';
/**
 * APOIO — descobrir os IPs desta máquina na rede (para mostrar na tela).
 * Não precisa abrir este arquivo para entender o chat.
 */

const os = require('os');

// Placas virtuais do Docker: só existem dentro desta máquina.
const VIRTUAL = /^(docker|br-|veth|virbr)/;

/** IPv4 de cada placa de rede ativa, sem o 127.0.0.1. Ex.: [{ placa: 'wlp2s0', ip: '192.168.0.10' }] */
function ipsDaRede() {
  const resultado = [];
  for (const [placa, enderecos] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL.test(placa)) continue;
    for (const e of enderecos || []) {
      if (e.family === 'IPv4' && !e.internal) resultado.push({ placa, ip: e.address });
    }
  }
  return resultado;
}

module.exports = { ipsDaRede };
