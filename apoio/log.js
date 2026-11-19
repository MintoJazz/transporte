'use strict';
/**
 * LOG — cada linha mostra QUEM fez (ator) e QUAL operação de socket (tag).
 *   [SERVIDOR] accept    nova conexão de 127.0.0.1:50000
 *
 * Cada evento vai para dois lugares:
 *   1. a TELA (opcional), colorida com chalk;
 *   2. um ARQUIVO próprio: logs/<ator>/<operação>/<data-hora>.log
 *      (um .log para cada comunicação).
 *
 * Obs.: chalk é só para as cores. A comunicação usa apenas net e dgram.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const PASTA_LOGS = path.join(__dirname, '..', 'logs');

const COR_ATOR = {
  SERVIDOR: chalk.cyan,
  ANA: chalk.green,
  BRUNO: chalk.yellow,
  CARLOS: chalk.magenta,
};

/**
 * Cria uma função log(tag, texto). A "tag" indica a operação de socket (bind, accept, send...).
 * @param ator  quem está registrando (SERVIDOR, Ana, Bruno...)
 * @param tela  função que imprime a linha na tela; null = só grava em arquivo
 */
function criarLog(ator, { tela = (linha) => console.log(linha) } = {}) {
  const nome = ator.toUpperCase();
  const corAtor = COR_ATOR[nome] || chalk.blue;

  return (tag, texto) => {
    if (tela) tela(`${corAtor(`[${nome}]`.padEnd(10))} ${chalk.dim(tag.padEnd(9))} ${texto}`);
    gravarArquivo(ator, tag, texto);
  };
}

// ---------------------------------------------------------------------------
// Arquivos de log: logs/<ator>/<operação>/<AAAA-MM-DDTHH-MM-SS-mmm>.log
// ---------------------------------------------------------------------------

let ultimoCarimbo = '';
let repetidos = 0;

/** Data/hora LOCAL: { data: '2026-11-19', hora: '10-34-40', ms: '375' }. */
function partesDaData(d) {
  const p = (n, t = 2) => String(n).padStart(t, '0');
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`,
    ms: p(d.getMilliseconds(), 3),
  };
}

/** Nome do arquivo a partir da data/hora; acrescenta _1, _2... se cair no mesmo milissegundo. */
function nomeDoArquivo(pasta, { data, hora, ms }) {
  const carimbo = `${data}T${hora}-${ms}`;
  const chave = path.join(pasta, carimbo);
  repetidos = chave === ultimoCarimbo ? repetidos + 1 : 0;
  ultimoCarimbo = chave;
  return repetidos ? `${carimbo}_${repetidos}.log` : `${carimbo}.log`;
}

function gravarArquivo(ator, tag, texto) {
  try {
    const agora = partesDaData(new Date());
    const pasta = path.join(PASTA_LOGS, ator.toLowerCase(), tag);
    fs.mkdirSync(pasta, { recursive: true });
    const conteudo = [
      `data/hora: ${agora.data} ${agora.hora.replaceAll('-', ':')}.${agora.ms}`,
      `ator:      ${ator}`,
      `operação:  ${tag}`,
      `detalhe:   ${texto}`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(pasta, nomeDoArquivo(pasta, agora)), conteudo);
  } catch {
    // log em arquivo nunca pode derrubar o chat
  }
}

module.exports = { criarLog, PASTA_LOGS };
