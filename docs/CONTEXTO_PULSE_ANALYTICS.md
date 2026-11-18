# Pulse Analytics

Contexto de continuidade para o Codex, consolidado em 18 de novembro de 2026, no fuso America/Manaus. Este documento registra o trabalho feito na conversa e o estado dos arquivos entregues nessa data.

O projeto pertence ao contexto maior de portfólio de Jeziel. Ele desenvolve o Licit-AI em paralelo e decidiu criar um segundo projeto sozinho para demonstrar capacidade de construir uma solução de IA funcional. A motivação citada foi o programa AI Builder do iFood, com interesse em automações capazes de economizar horas reais de trabalho.

O usuário quer importar um CSV oficial de qualquer mês do Consumidor.gov.br e obter indicadores, comparação entre períodos e um boletim conferível. Também quer permitir que outras pessoas experimentem o projeto com baixo custo ou gratuidade. Durante a configuração do n8n, preferiu orientações em português e passo a passo, enviando o resultado de cada etapa.

O nome inicial era Radar de Atendimento. A decisão posterior foi usar Pulse Analytics. Houve uma sugestão inicial de implementação com Python, Pandas e Streamlit. O código efetivamente entregue usa HTML, CSS, JavaScript com módulos ES, um servidor Python da biblioteca padrão e o n8n com Google Gemini.

O estado verificado ao encerrar esta etapa está registrado na tabela.

| Parte | Estado |
| --- | --- |
| Importação de CSV oficial e ZIP com um CSV | Implementada |
| Identificação de período pela data de finalização | Implementada |
| Análise com um único mês | Implementada e exercitada com dados reais |
| Comparação entre meses | Implementada e exercitada |
| Filtro por segmento e tabela por problema | Implementados |
| Boletim calculado a partir dos indicadores | Implementado |
| Rascunho com IA pelo n8n e Gemini | Validado no computador do usuário |
| Workflow para importação em outro n8n | Incluído no pacote, com configuração de credencial e modelo a realizar após importar |
| Testes automatizados do pacote atual | Sete testes passando |
| Configuração de um repositório remoto para este pacote | Pendente |
| Hospedagem pública da integração atual | Pendente |
| Medição de tempo economizado | Pendente |

O código de referência é o conteúdo da pasta `pulse-analytics-n8n` no ZIP mais recente de mesmo nome. A última atualização desse pacote incluiu o workflow exportado pelo usuário, uma cópia preparada para o repositório e instruções no README.

| Artefato entregue | Conteúdo |
| --- | --- |
| `pulse-analytics-n8n.zip` | Aplicação atual, servidor Python, testes, README e workflow n8n |
| `CONTEXTO_PULSE_ANALYTICS.md` | Este documento para transferir o contexto ao Codex |
| `basecompleta2025-03.zip` | Base histórica completa usada para testar outro período |
| `My workflow.json` | Export original enviado pelo usuário e usado para preparar o workflow do pacote |

Ao retomar no Codex, use a pasta local em que o ZIP atual foi extraído. Os caminhos absolutos do ambiente desta conversa aparecem no fim do documento para localizar os artefatos dentro deste ambiente. A instalação local de Jeziel tem seus próprios caminhos.

Os arquivos da aplicação têm as responsabilidades abaixo.

| Caminho relativo à pasta do projeto | Responsabilidade |
| --- | --- |
| `README.md` | Execução, importação do workflow, regras da análise e evidências da validação |
| `serve.py` | Serve o painel e encaminha os indicadores ao n8n |
| `dist/index.html` | Estrutura da interface e nome Pulse Analytics |
| `dist/style.css` | Estilos da interface |
| `dist/app.mjs` | Estado da tela, filtros, importação, gráficos, tabela, cópia e interação com IA |
| `dist/analysis.mjs` | Leitura de CSV, datas, agregação, taxas, comparação e boletim calculado |
| `dist/import-files.mjs` | Entrada normal do importador de CSV e ZIP |
| `dist/csv-worker.mjs` | Processamento do arquivo em Web Worker |
| `dist/ai.mjs` | Montagem do JSON enviado ao servidor e leitura do texto retornado |
| `dist/demo.json` | Agregados de agosto e setembro de 2026 usados na demonstração |
| `dist/fflate.mjs` | Biblioteca de descompactação incorporada ao projeto |
| `dist/fflate-LICENSE.txt` | Licença da biblioteca incorporada |
| `dist/inter.woff2` e `dist/inter-OFL.txt` | Fonte da interface e sua licença |
| `dist/radar.svg` | Ícone herdado da primeira versão |
| `tests/analysis.test.mjs` | Sete testes do importador, cálculos, exportação e contrato com o servidor |
| `workflows/pulse-boletim.json` | Workflow n8n preparado para importação |

A aplicação usa os arquivos de `dist` diretamente. O procedimento de execução é `python3 serve.py`. As dependências do servidor pertencem à biblioteca padrão do Python, e os testes usam o executor de testes do Node.js. Esses são os comandos de execução e verificação documentados no pacote atual.

O fluxo começa com a importação no navegador. O worker descompacta e interpreta o arquivo, e os agregados alimentam os indicadores, o gráfico, a tabela e o boletim calculado. O botão Gerar boletim com IA produz uma requisição adicional com o recorte selecionado.

| Origem | Operação | Destino |
| --- | --- | --- |
| Painel no navegador | Importação de CSV ou ZIP | Web Worker |
| Web Worker | Agregados por mês, segmento e problema | Painel |
| Painel | `POST /api/boletim` | Servidor Python na porta 8000 |
| Servidor Python | `POST /webhook/pulse-boletim` | n8n na porta 5678 |
| Webhook do n8n | Conexão principal | Basic LLM Chain |
| Google Gemini Chat Model | Conexão de modelo `ai_languageModel` | Basic LLM Chain |
| n8n | JSON com `text` | Servidor Python e, em seguida, painel |

O nó Gemini está ligado à entrada Model do Basic LLM Chain. A conexão principal do workflow liga Webhook a Basic LLM Chain.

O navegador processa os arquivos completos e conserva os agregados na memória da sessão. Ao recarregar a página, a aplicação inicia novamente com os dados de demonstração. O envio ao n8n contém indicadores dos problemas em destaque. A chave da API do Gemini fica cadastrada nas credenciais do n8n.

O importador foi construído para o esquema de dados do Consumidor.gov.br. A intenção de aceitar qualquer mês refere-se a arquivos com as colunas necessárias desse esquema. A compatibilidade implementada está descrita na tabela.

| Aspecto | Comportamento atual |
| --- | --- |
| Colunas usadas | Data Finalização, Segmento de Mercado, Problema, Situação e Avaliação Reclamação |
| Variações de cabeçalho | Há aliases e normalização para grafias, acentos e espaços |
| Separadores | Ponto e vírgula, vírgula e tabulação |
| Preâmbulo de separador | Reconhecimento de `sep=` |
| Codificação | UTF-8, fallback Windows-1252 e UTF-16 com BOM |
| Campos entre aspas | Suporte a separadores e quebras de linha dentro do campo |
| Datas | Formatos brasileiros e ISO, incluindo variantes com hora |
| Período da análise | Mês da data de finalização |
| CSVs com vários meses | Os períodos encontrados são agregados separadamente |
| ZIP | Um CSV por ZIP, com identificação por extensão ou assinatura |
| Limite em código | `250 * 1024 * 1024` bytes, exibido na interface como 250 MB |
| ZIP acima do limite | Há verificação do arquivo recebido e do tamanho descompactado do CSV |
| Tempo de processamento no worker | Até 120 segundos |
| Problemas de qualidade | Contadores para situação descartada, data inválida, linha malformada, avaliação desconhecida e problema ausente |

A primeira importação de arquivos próprios inicia uma análise com esses arquivos. Importações posteriores acrescentam os períodos encontrados. Para um mês já carregado, a última base substitui o agregado anterior desse mês. Esse comportamento foi escolhido para evitar duplicação de contagens ao reimportar uma base.

A identificação do mês utiliza o conteúdo da coluna de data. O importador também foi exercitado programaticamente com um arquivo cujo nome era `teste.zip`. O painel seleciona inicialmente o mês mais recente carregado e oferece meses anteriores para comparação.

Os indicadores seguem estas regras de cálculo.

- Reclamações finalizadas entram no total do período.
- Reclamações canceladas e encerradas são contabilizadas no relatório de qualidade como situações descartadas.
- Avaliadas correspondem às reclamações marcadas como resolvidas ou não resolvidas.
- A proporção de não resolução é `não resolvidas / avaliadas`.
- Quando o denominador é zero, a interface apresenta a ausência de uma taxa calculável.
- A variação entre meses é `contagem atual - contagem anterior`.
- Maiores altas e quedas usam a diferença no número de reclamações.
- Os filtros de período e segmento afetam os indicadores e o payload da IA.
- A busca por problema e a ordenação atuam sobre a tabela.
- A exportação CSV acompanha as linhas da tabela filtrada e trata valores de texto que poderiam ser interpretados como fórmulas em planilhas.

O boletim calculado e o rascunho com IA têm ações próprias na interface. O boletim calculado usa `createBrief` e apresenta volume, problema em destaque, resolução e uma pergunta de investigação. O rascunho com IA aparece na área Rascunho com IA e tem o botão Copiar rascunho. Uma falha da requisição à IA preserva a possibilidade de consultar e copiar o boletim calculado.

A função `createBriefPayload` seleciona até cinco problemas. Com comparação, ela combina altas e quedas e ordena pela maior variação absoluta, usando a contagem atual como desempate. Com um único mês, usa os problemas com maior volume. O payload atual contém período, segmento e contagens desses problemas. Os totais gerais e as métricas de resolução aparecem no boletim calculado da interface.

O exemplo a seguir usa dados fictícios e foi utilizado para testar a comunicação entre os componentes.

```json
{
  "mes": "2026-09",
  "mes_comparacao": "2026-08",
  "segmento": "Telefonia",
  "problemas": [
    {
      "nome": "Cobrança indevida",
      "atual": 120,
      "anterior": 90,
      "variacao": 30
    }
  ]
}
```

Para um único mês, `mes_comparacao`, `anterior` e `variacao` ficam ausentes. A resposta esperada do n8n é um objeto com texto preenchido.

```json
{
  "text": "Boletim de atendimento com os dados fornecidos e uma pergunta de investigação."
}
```

O cliente verifica se `text` é uma string preenchida e remove marcações simples de negrito. A interface insere o resultado como texto, usando `textContent`. A conferência dos números gerados foi realizada manualmente nos casos reais descritos adiante. Uma validação semântica automática das afirmações do modelo permanece uma possível evolução.

A requisição do navegador tem limite de 40 segundos. O servidor aguarda o n8n por até 35 segundos. Ao mudar o recorte, a interface cancela a espera da requisição anterior e descarta uma resposta associada ao recorte antigo. O servidor limita o corpo recebido e o texto devolvido a 64 KiB.

O `serve.py` está configurado para uso local, com bind em `127.0.0.1:8000`, verificações de Host e Origin e encaminhamento fixo para `127.0.0.1:5678`. Um `429` recebido do n8n é repassado como `429`. Outros erros do upstream resultam em `502`. O código atual teve cenários de sucesso, cota, resposta vazia e falha exercitados com um webhook simulado.

O objetivo de permitir testes gratuitos orientou a escolha do provedor. A primeira configuração usou OpenAI Chat Model e `gpt-4.1-mini`. Depois da discussão sobre cobrança da API, o usuário migrou o fluxo para Google Gemini e cadastrou uma chave do Google AI Studio no n8n. A sugestão de modelo foi `gemini-3.1-flash-lite`, usando uma configuração elegível ao Free Tier. As cotas e condições efetivas da conta devem ser conferidas ao preparar a hospedagem.

O usuário executou o fluxo com Gemini e enviou respostas reais do terminal e do painel. O export `My workflow.json` contém um nó Gemini com `parameters.options` vazio e omite `modelName`. Isso impede identificar, apenas pelo arquivo, o modelo efetivamente resolvido pela instalação. A seleção do modelo foi documentada como configuração explícita ao importar em outro n8n.

O workflow exportado e a cópia preparada têm estas versões de nós.

| Nó | Tipo | Versão do nó |
| --- | --- | --- |
| Webhook | `n8n-nodes-base.webhook` | 2.1 |
| Basic LLM Chain | `@n8n/n8n-nodes-langchain.chainLlm` | 1.9 |
| Google Gemini Chat Model | `@n8n/n8n-nodes-langchain.lmChatGoogleGemini` | 1.1 |

O export original tem o nome My workflow. A cópia para o repositório usa Pulse Analytics — Boletim. Essa cópia preserva parâmetros dos nós, conexões, posições e versões. Foram removidas referências às credenciais, identificação da instância, identificação e versão do workflow original e o identificador específico do webhook. A cópia foi preparada com `active: false` para receber configuração e publicação na instalação de destino.

A estrutura dessa cópia foi conferida programaticamente contra o export original. A importação dela em uma nova instância permanece a verificar. A execução ponta a ponta confirmada pelo usuário ocorreu no workflow original da sua instalação local.

O Webhook usa método POST, caminho `pulse-boletim` e `responseMode: "lastNode"`. No editor, a configuração de resposta utilizada foi When Last Node Finishes, com o retorno do primeiro objeto JSON.

O prompt atualizado está abaixo. No Basic LLM Chain, Source for Prompt fica em Fixed, com Define below selecionado. O conteúdo de Prompt (User Message) fica em Expression para permitir a inclusão do JSON recebido.

```text
Escreva um boletim curto de atendimento em português.
Informe o mês e o segmento. Se houver comparação, destaque a maior
variação em número de casos. Se houver só um mês, destaque o problema
mais frequente. Use apenas os números fornecidos e termine com uma
pergunta de investigação.
Use linguagem neutra e chame os registros de reclamações.
Reserve qualificações como “crítico” ou “expressivo” para situações
com critérios explícitos nos dados.
Apresente possíveis causas como hipóteses a investigar.
Termine com uma pergunta aberta sobre a concentração das reclamações
por tipo, canal ou etapa da jornada.
Indicadores recebidos
{{ JSON.stringify($json.body) }}
```

No arquivo JSON do n8n, o valor de `text` começa com `=`, que é o marcador de serialização da expressão. A última ampliação do prompt foi adicionada depois que a IA usou qualificações como “volume crítico” e perguntas que presumiam falhas operacionais. O usuário publicou a alteração e apresentou novos boletins com as causas descritas como hipóteses.

A configuração local observada no computador do usuário foi Node.js `v22.23.2`, npm `10.9.8` e npx `10.9.8`. O n8n foi iniciado com a referência `n8n@2`. A versão exata instalada do n8n ainda precisa ser registrada. O usuário criou uma conta local no n8n e já cadastrou a credencial do Gemini.

Para iniciar o n8n em um novo dia, o comando usado foi o seguinte.

```bash
N8N_LISTEN_ADDRESS=127.0.0.1 npx n8n@2
```

O editor fica em http://localhost:5678. O terminal deve permanecer aberto durante o uso. Na instalação já configurada pelo usuário, a continuação começa abrindo o workflow existente e verificando sua publicação.

Para configurar outra instalação, importe `workflows/pulse-boletim.json` pelo menu de três pontos do editor, usando Import from File. No nó Gemini, selecione uma credencial válida e confirme o modelo escolhido. A chave fica no formulário de credenciais do n8n. Publique o workflow para registrar o endpoint de produção.

Em outro terminal, dentro da pasta que contém `serve.py`, inicie o painel.

```bash
python3 serve.py
```

O painel fica em http://localhost:8000. Esse servidor implementa a rota `/api/boletim` usada pelo botão de IA. O servidor HTTP estático usado nas primeiras etapas da conversa servia os arquivos de interface. A execução documentada do pacote atual usa `serve.py`.

O comando abaixo exercita o endpoint local de produção do n8n com o exemplo fictício.

```bash
curl -sS -w '\nHTTP %{http_code}\n' \
  http://localhost:5678/webhook/pulse-boletim \
  -H 'Content-Type: application/json' \
  --data '{
    "mes": "2026-09",
    "mes_comparacao": "2026-08",
    "segmento": "Telefonia",
    "problemas": [
      {"nome": "Cobrança indevida", "anterior": 90, "atual": 120, "variacao": 30}
    ]
  }'
```

O usuário confirmou HTTP 200 e um objeto com `text` nesse endpoint. Também confirmou o boletim exibido no painel depois de clicar em Gerar boletim com IA.

Durante a montagem, surgiram duas dificuldades que já foram resolvidas.

| Sintoma | Causa identificada e procedimento usado |
| --- | --- |
| Aparecia apenas o JSON de entrada do Webhook | Listen for test event executava a etapa do Webhook. Para exercitar o fluxo completo, foi usado Execute workflow no editor e depois uma nova chamada à Test URL |
| Workflow execution cannot start e Prompt (User Message) is required | Foi conferida a seleção Fixed / Define below na origem do prompt e preenchida a caixa inferior em Expression, com o texto e `JSON.stringify($json.body)` |

A Test URL termina em `/webhook-test/pulse-boletim`. Ela foi usada durante as execuções manuais. A URL de produção termina em `/webhook/pulse-boletim` e foi usada após a publicação do workflow.

A validação com dados reais abrangeu os períodos abaixo.

| Período | Linhas da base completa | Reclamações finalizadas usadas nos indicadores |
| --- | --- | --- |
| Março de 2025 | 153.208 | 140.158 |
| Agosto de 2026 | 394.120 | 394.120 |
| Setembro de 2026 | 358.865 | 358.865 |

As bases de agosto e setembro compõem a demonstração, com 752.985 reclamações finalizadas no conjunto. O usuário testou o segmento Operadoras de Telecomunicações, a comparação e a seleção Sem comparação.

Na comparação mostrada pelo usuário, Oferta não cumprida / serviço não fornecido/ venda enganosa / publicidade enganosa passou de 2.110 reclamações em agosto para 2.311 em setembro, diferença de 201. Esse caso confirmou o uso dos períodos e contagens enviados ao fluxo.

Para setembro de 2026, com telecomunicações e Sem comparação, os cinco valores do boletim foram conferidos nos agregados da demonstração.

| Problema | Reclamações |
| --- | --- |
| Cobrança indevida / abusiva para alterar ou cancelar o contrato | 3.680 |
| Cobrança por serviço/produto não contratado / não reconhecido / não solicitado | 3.252 |
| Oferta não cumprida / serviço não fornecido/ venda enganosa / publicidade enganosa | 2.311 |
| Cobrança após cancelamento do serviço | 2.130 |
| Negativação indevida (SPC, Serasa, SCPC etc) | 1.890 |

A base de março de 2025 foi obtida para testar um período fora da demonstração. Durante a consulta em 18/11/2026, o site do Consumidor.gov.br apresentou manutenção e falhas da listagem de arquivos. O catálogo de dados do Ministério da Justiça também apresentou indisponibilidade. O arquivo completo foi recuperado de uma cópia preservada no Internet Archive.

O ZIP recuperado contém `base_completa_2025-03.csv`, com 68.354.608 bytes. O ZIP tem 6.689.791 bytes. A integridade do ZIP e a leitura pela função normal `importComplaintFile` foram verificadas.

Uma segunda leitura, feita com o módulo csv do Python, confirmou os seguintes números de março de 2025.

| Medida | Valor |
| --- | --- |
| Linhas de dados | 153.208 |
| Finalizadas não avaliadas | 93.077 |
| Finalizadas avaliadas | 47.081 |
| Finalizadas no total | 140.158 |
| Canceladas | 11.526 |
| Encerradas | 1.524 |
| Situações descartadas no total | 13.050 |
| Não resolvidas entre as avaliadas | 25.500 |
| Segmentos identificados | 44 |
| Datas inválidas e linhas malformadas identificadas pelo importador | 0 |

O usuário importou esse ZIP no painel, selecionou Todos os segmentos e Sem comparação e gerou o rascunho real com Gemini. Os cinco números do texto foram conferidos diretamente no arquivo.

| Problema em março de 2025 | Reclamações |
| --- | --- |
| Cobrança indevida / abusiva para alterar ou cancelar o contrato | 10.638 |
| Cobrança por serviço/produto não contratado / não reconhecido / não solicitado | 8.209 |
| Dificuldade / atraso na devolução de valores pagos / reembolso / retenção de valores | 7.083 |
| Cálculo de juros, saldo devedor (contestação, solicitação de histórico, dúvidas) | 6.655 |
| Oferta não cumprida / serviço não fornecido/ venda enganosa / publicidade enganosa | 6.433 |

Uma leitura do mesmo arquivo para telecomunicações encontrou 16.658 finalizadas, 6.556 avaliadas e 1.898 não resolvidas. O problema de maior volume nesse recorte foi cobrança indevida para alterar ou cancelar o contrato, com 2.232 reclamações. Esses valores foram conferidos pelo código e podem servir como referência para retomar esse filtro.

O comando dos testes do pacote atual é executado na pasta do projeto.

```bash
node --test
```

Na última conferência antes de criar este documento, os sete testes passaram. A cobertura existente contempla reconhecimento de meses e denominador da taxa, análise de um único mês, codificação Windows-1252, colunas obrigatórias, importação de ZIP e seus erros, exportação CSV, montagem do payload e leitura da resposta do Webhook, incluindo cota e texto vazio.

Também houve verificações complementares com uma simulação de DOM e webhook. Elas exercitaram filtros, cópia, CSV de outro período, comparação, resposta de IA, descarte de resposta antiga e falha da requisição. Essas verificações complementares ocorreram no ambiente de trabalho desta conversa. Os testes repetíveis incluídos no pacote estão em `tests/analysis.test.mjs`.

A execução real do Gemini foi confirmada pelo usuário no seu computador. O nome exato do modelo, a cota efetiva da conta e o comportamento de uma cota real esgotada ainda precisam ser conferidos na instalação. O tratamento de HTTP 429 foi exercitado por simulação. Falhas de uma chamada ao modelo também podem chegar ao painel por uma resposta de erro do workflow.

Há uma publicação privada anterior registrada no histórico. Ela foi criada na fase Radar de Atendimento, com a primeira implementação de IA local no navegador. O pacote atual com Python, n8n e Gemini foi validado por execução local. [Publicação privada original](https://radar-de-atendimento.truemackerel2.chatgpt.site/)

Na etapa da publicação privada antiga, a inspeção de navegador ficou limitada pelo login. A situação atual de acesso e conteúdo dessa URL deve ser verificada quando o trabalho de hospedagem for retomado. O endpoint localhost do computador do usuário atende o desenvolvimento local. A geração com IA por um link compartilhável depende de hospedar e conectar o backend e o n8n.

Existem versões anteriores no ambiente desta conversa.

| Pasta ou pacote | Papel no histórico |
| --- | --- |
| `radar-de-atendimento/` e `radar-de-atendimento.zip` | Primeira versão, com sugestão de investigação pela Prompt API de um modelo do navegador |
| `pulse-analytics-n8n/` e `pulse-analytics-n8n.zip` | Versão atual, com o fluxo local n8n e Gemini |
| `radar-verificacao/` | Bases e verificações auxiliares usadas no desenvolvimento |
| `upload/My workflow.json` | Arquivo original exportado do n8n pelo usuário |

A continuidade deve partir do pacote Pulse Analytics com n8n. O desenvolvimento já tem uma base funcional e dados reais de validação. A preparação do repositório remoto, a escolha de hospedagem e a medição de economia de tempo compõem as próximas entregas.

A ordem abaixo é uma proposta de continuidade, registrada para orientar a próxima sessão.

1. Abrir o pacote atual no Codex, ler o README e executar os sete testes para confirmar o ambiente de destino.
2. Confirmar no n8n local o modelo efetivamente selecionado e a versão exata do n8n. Se o objetivo for reproduzir exatamente essa escolha, registrar o identificador do modelo no workflow exportado para o projeto.
3. Conferir a importação do workflow preparado em uma instalação de destino, com a credencial configurada, e o retorno do campo text pelo endpoint publicado.
4. Organizar e conectar o repositório remoto que Jeziel escolher para o Pulse Analytics.
5. Definir a hospedagem com o objetivo de permitir testes por terceiros e controlar o consumo da cota de IA. A solução atual tem endereços, bind e verificações de origem voltados ao uso local.
6. Conferir o critério de maior variação absoluta em cenários com quedas, porque esse é o critério de seleção do payload, e explicitar no texto que a IA recebe até cinco problemas em destaque.
7. Medir a preparação do mesmo tipo de boletim manualmente e com o app, incluindo a revisão e correção do texto. Registrar o tamanho da amostra, o tempo e os resultados efetivamente observados.
8. Preparar a demonstração e a apresentação no portfólio com os resultados medidos, a origem dos dados e os limites da validação.

A medição de economia de tempo foi proposta ao longo da conversa, mas o experimento ainda precisa ser executado. A comunicação do portfólio pode usar os números de reclamações já conferidos e a demonstração funcional. Um resultado de horas economizadas dependerá desse experimento.

Para localizar os artefatos neste ambiente de conversa, os caminhos usados foram os seguintes.

| Artefato | Caminho no ambiente desta conversa |
| --- | --- |
| Pasta do código atual | `/workspace/scratch/982b76289a59/pulse-analytics-n8n` |
| Pacote atualizado | `/workspace/scratch/982b76289a59/entrega-radar/pulse-analytics-n8n.zip` |
| Este documento | `/workspace/scratch/982b76289a59/entrega-radar/CONTEXTO_PULSE_ANALYTICS.md` |
| Base de março | `/workspace/scratch/982b76289a59/dados-teste/basecompleta2025-03.zip` |
| Base de agosto | `/workspace/scratch/982b76289a59/radar-verificacao/agosto.zip` |
| Base de setembro | `/workspace/scratch/982b76289a59/radar-verificacao/setembro.zip` |
| Export original enviado pelo usuário | `/workspace/scratch/982b76289a59/upload/My workflow.json` |

Os hashes abaixo identificam os arquivos entregues na última atualização do pacote. Eles ajudam a reconhecer essa versão quando houver mais de um download com o mesmo nome.

| Arquivo | SHA-256 |
| --- | --- |
| `pulse-analytics-n8n.zip` | `978ffb778e3ee19974309f2452b769ca6a88f388eabc63ce199fe94a4d352662` |
| `workflows/pulse-boletim.json` | `b580acdfb310562f5c251742e334b46730b85e5fc0f6dd6280a40ec954a1b379` |
| `basecompleta2025-03.zip` | `7cabe2076e726eeabcadb8f21af44664b0b3f0566597495e6f7959409e728d30` |

As referências abaixo foram usadas ao longo do trabalho.

- A origem dos dados mensais é a página de dados abertos do Consumidor.gov.br. [Dados abertos](https://www.consumidor.gov.br/pages/dadosabertos/externo/)
- A demonstração utilizou os arquivos oficiais de agosto e setembro de 2026. [Agosto de 2026](https://www.consumidor.gov.br/pages/publicacao/externo/20260900000010980/download) e [setembro de 2026](https://www.consumidor.gov.br/pages/publicacao/externo/20261000000011035/download)
- A base completa de março de 2025 está catalogada no Ministério da Justiça. [Catálogo da base](https://dados.mj.gov.br/dataset/reclamacoes-do-consumidor-gov-br/resource/65706bcd-80ab-4231-a7ef-9e329420f001)
- O arquivo usado no teste adicional veio desta captura preservada. [ZIP de março de 2025 no Internet Archive](https://web.archive.org/web/20260119185720id_/https://dados.mj.gov.br/dataset/0182f1bf-e73d-42b1-ae8c-fa94d9ce9451/resource/65706bcd-80ab-4231-a7ef-9e329420f001/download/basecompleta2025-03.zip)
- A descrição das colunas está no dicionário oficial. [Dicionário de dados](https://dados.mj.gov.br/dataset/0182f1bf-e73d-42b1-ae8c-fa94d9ce9451/resource/90aedbfe-3c91-4c18-86a5-f408d07e7210/download/dicionario-de-dados---consumidorgovbr-v3.pdf)
- A configuração inicial do n8n seguiu a documentação de execução com npm e npx. [Instalação do n8n](https://docs.n8n.io/deploy/host-n8n/install-options/install-with-npm.md)
- A configuração do trigger e da resposta seguiu a documentação do Webhook. [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- O prompt é configurado no Basic LLM Chain. [Basic LLM Chain](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.chainllm/)
- O modelo é conectado pela integração de chat do Gemini. [Google Gemini Chat Model](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatgooglegemini/)
- A exportação e importação do workflow usam JSON. [Exportação e importação no n8n](https://docs.n8n.io/workflows/export-import/)
- A chave é criada e administrada no Google AI Studio. [API keys](https://aistudio.google.com/apikey)
- As condições de gratuidade, faturamento e cotas precisam ser conferidas na preparação do ambiente compartilhado. [Preços](https://ai.google.dev/gemini-api/docs/pricing), [faturamento](https://ai.google.dev/gemini-api/docs/billing) e [limites](https://ai.google.dev/gemini-api/docs/rate-limits)

Uma mensagem para iniciar a próxima sessão do Codex pode ser copiada abaixo.

```text
Leia CONTEXTO_PULSE_ANALYTICS.md e inspecione o código desta pasta.
Estou continuando meu projeto solo Pulse Analytics, criado para o portfólio
de AI Builder, em paralelo ao Licit-AI.

A aplicação atual usa HTML/CSS/JavaScript, um servidor Python e n8n com
Google Gemini. Já consegui importar CSVs oficiais de meses diferentes e
gerar boletins reais no meu computador.

Quero continuar a partir desse código e dos resultados já verificados.
Confira o estado local, execute os testes existentes e me ajude a avançar
na preparação do repositório e da demonstração acessível a outras pessoas,
com atenção à minha preferência por baixo custo ou gratuidade.

Considere a ausência do nome do modelo no export do n8n, a hospedagem
pública pendente e a medição de tempo economizado ainda por realizar.
Use português nas explicações e oriente passo a passo quando alguma
configuração depender de ações no meu computador ou nas minhas contas.
```

## Retomada na pasta local — 18 de novembro de 2026

- O README, o servidor, o contrato da IA, os testes e o workflow foram inspecionados nesta pasta. Os sete testes passaram com `node tests/analysis.test.mjs`; `node --test` também terminou sem falhas.
- O Git local foi inicializado na branch `main`, com o remoto `origin` configurado como `git@github.com:jeziel-monteiro/pulse-analytics.git`. O acesso SSH foi validado, e o repositório remoto estava vazio na conferência anterior ao primeiro envio. [Repositório no GitHub](https://github.com/jeziel-monteiro/pulse-analytics)
- Foi criado o `.gitignore` para excluir credenciais e configurações locais, bases CSV/ZIP, dependências e temporários. A pasta `dist/` continua incluída no versionamento.
- A instância local do n8n respondeu HTTP 200 em `/healthz`. Essa consulta verifica a disponibilidade do serviço, sem executar o workflow nem validar uma chamada ao Gemini.
- O hash de `workflows/pulse-boletim.json` corresponde ao registrado neste documento, e o arquivo continua sem credenciais e sem `modelName`. A versão exata do n8n e o modelo selecionado permanecem pendentes; a versão não foi exposta pela consulta às configurações públicas da instância.
- A hospedagem pública e a medição de economia de tempo permanecem pendentes.
