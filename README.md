# Av3 — Chat estilo WhatsApp com Sockets (Node.js)

Redes de Computadores · IFRS Campus Rio Grande · TADS · Prof. Luciano V. Gonçalves

- **Ponto a ponto:** TCP direto entre os clientes.
- **Grupo:** UDP, o servidor reenvia para todos.
- **Cadastro e lista de contatos:** TCP com o servidor, porta 9990.

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `servidor.js` | o servidor inteiro, de cima para baixo (PARTES 1 a 4) |
| `cliente.js` | o cliente inteiro, de cima para baixo (PARTES 1 a 6) |
| `apoio/` | ferramentas: mensagens JSON por linha, logs, cores. Não precisa abrir para entender o chat. |

A rede usa só `net` (TCP) e `dgram` (UDP), nativos do Node.

## Como rodar

```
npm install
```

| Terminal | Comando |
| --- | --- |
| T1 | `npm run servidor` |
| T2 | `npm run ana` |
| T3 | `npm run bruno` |
| T4 | `npm run carlos` |
| T5 | `npm run derrubar-bruno` (mata o Bruno sem avisar) |

Comandos no cliente: `/lista` · `/privado <nick> <mensagem>` · `/grupo <mensagem>` · `/sair`

Logs de cada comunicação em `logs/<ator>/<operação>/`. Para apagar: `npm run limpar-logs`.
