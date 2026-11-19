'use strict';
/**
 * VISUAL DO TERMINAL — caixas (boxen), tabelas (cli-table3) e cores (chalk).
 * Só aparência: nada aqui envia ou recebe dados pela rede.
 */

const boxen = require('boxen');
const chalk = require('chalk');
const Table = require('cli-table3');

/** Caixa com borda arredondada: título em negrito + linhas. */
function caixa(titulo, linhas, cor = 'cyan') {
  return boxen([chalk.bold(titulo), '', ...linhas].join('\n'), {
    padding: { left: 1, right: 1 },
    borderStyle: 'round',
    borderColor: cor,
  });
}

/** Tabela da lista de contatos. A linha de quem pediu ("eu") fica destacada. */
function tabelaContatos(contatos, eu) {
  const tabela = new Table({
    head: ['Nick', 'IP', 'Porta TCP (direto)', 'Porta UDP (grupo)'].map((h) => chalk.cyan(h)),
  });
  for (const c of contatos) {
    const linha = [c.nick, c.ip, c.portaTcp, c.portaUdp].map(String);
    tabela.push(c.nick === eu ? linha.map((v) => chalk.bold.green(v)) : linha);
  }
  return `${tabela.toString()}\n${chalk.dim(`${contatos.length} contato(s) online`)}`;
}

/** Mensagem de chat recebida: [PRIVADO] em amarelo, [GRUPO] em magenta. */
function mensagemChat({ canal, de, texto }) {
  const rotulo = canal === 'grupo' ? chalk.magenta.bold('[GRUPO]') : chalk.yellow.bold('[PRIVADO]');
  return `${rotulo} ${chalk.bold(de)}: ${texto}`;
}

const erro = (texto) => chalk.red(`Erro: ${texto}`);
const aviso = (texto) => chalk.yellow(texto);

module.exports = { caixa, tabelaContatos, mensagemChat, erro, aviso };
