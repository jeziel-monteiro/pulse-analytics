# Pulse Analytics

Aplicação web para gerar boletins de atendimento com os dados abertos do Consumidor.gov.br. O painel importa CSVs ou os ZIPs oficiais, identifica os meses presentes e calcula indicadores por segmento e por tipo de problema.

## Como usar

1. Abra o painel e selecione um CSV ou ZIP do Consumidor.gov.br.
2. Para comparar períodos, carregue bases adicionais na mesma sessão. O painel seleciona o período mais recente e oferece os anteriores no filtro.
3. Escolha um segmento e consulte o boletim e os dados por problema. Copie o texto ou exporte as linhas filtradas como CSV.

A demonstração abre com agregados de agosto e setembro de 2026. A primeira importação de dados próprios inicia uma nova análise. Se duas bases contiverem o mesmo mês, a última substitui a anterior para evitar duplicar contagens.

## Dados aceitos

O importador usa cinco colunas da base pública: Data Finalização, Segmento de Mercado, Problema, Situação e Avaliação Reclamação. O limite é de 250 MB por CSV descompactado. Use um CSV por ZIP. O navegador processa os dados em um Web Worker e mantém os agregados em memória durante a sessão.

A análise conta reclamações finalizadas pelo mês da data de finalização. A taxa de não resolução usa como denominador a soma de registros avaliados como resolvidos e não resolvidos. A maior alta ou queda usa a diferença na contagem de registros.

O boletim automático usa as contagens verificáveis do painel. O botão **Gerar boletim com IA** envia o período, o segmento e até cinco problemas ao n8n. Com dois períodos, o painel prioriza os problemas com maior variação absoluta. Com um período, envia os de maior volume. O painel exibe a resposta como rascunho e permite copiá-la.

## Executar e verificar

Inicie o n8n com Node.js e npx no terminal.

```sh
N8N_LISTEN_ADDRESS=127.0.0.1 npx n8n@2
```

Abra http://localhost:5678 e importe `workflows/pulse-boletim.json` pelo menu **⋯ → Import from File** do editor. O arquivo contém o fluxo Webhook, Basic LLM Chain e Google Gemini Chat Model, com o prompt validado na demonstração.

No nó **Google Gemini Chat Model**, selecione ou crie a credencial com sua chave e escolha o modelo. A configuração proposta neste projeto é `gemini-3.1-flash-lite`. O export recebido para preparar o projeto usa o padrão da instalação e omite o nome do modelo. Por isso, a seleção explícita no editor faz parte da configuração ao importar.

Publique o workflow. O endpoint local é `http://localhost:5678/webhook/pulse-boletim`. Ele recebe um `POST` JSON e retorna o campo `text` com o boletim. A chave do Gemini fica nas credenciais do n8n.

O fluxo fornecido usa o nome **Pulse Analytics — Boletim** e as conexões do export testado. As referências às credenciais e à instância foram removidas da cópia para o repositório. Ao importar, o fluxo começa desativado e pode ser publicado após a configuração.

Na pasta do projeto, inicie o servidor com Python 3.

```sh
python3 serve.py
```

Abra http://localhost:8000 e clique em **Gerar boletim com IA** para rodar o workflow com o recorte selecionado.

Use Node.js 22 ou superior para testar o importador, os cálculos e os indicadores enviados ao Webhook.

```sh
node --test
```

## Verificação com dados oficiais

O fluxo foi testado localmente com as bases de agosto e setembro de 2026, com comparação e com um único mês. Um arquivo adicional de março de 2025 foi importado para verificar um período fora da demonstração. Os totais foram conferidos com uma leitura independente do CSV.

| Base | Reclamações finalizadas, todos os segmentos |
| --- | --- |
| Março de 2025 | 140.158 |
| Agosto de 2026 | 394.120 |
| Setembro de 2026 | 358.865 |

A base completa de março de 2025 tem 153.208 linhas. As 13.050 reclamações canceladas ou encerradas ficam fora dos indicadores. O boletim recebido do Gemini para todos os segmentos reproduziu os cinco problemas de maior volume, com 10.638, 8.209, 7.083, 6.655 e 6.433 reclamações, respectivamente.

A integração documentada usa o painel e o n8n no mesmo computador. O acesso remoto à geração com IA depende de hospedar esses componentes e configurar a conexão entre eles. A medição de tempo economizado permanece pendente.

## Fontes

- [Dados abertos do Consumidor.gov.br](https://www.consumidor.gov.br/pages/dadosabertos/externo/)
- [Arquivo de agosto de 2026](https://www.consumidor.gov.br/pages/publicacao/externo/20260900000010980/download)
- [Arquivo de setembro de 2026](https://www.consumidor.gov.br/pages/publicacao/externo/20261000000011035/download)
- [Base completa de março de 2025](https://dados.mj.gov.br/dataset/reclamacoes-do-consumidor-gov-br/resource/65706bcd-80ab-4231-a7ef-9e329420f001)
- [Cópia arquivada do ZIP de março de 2025](https://web.archive.org/web/20260119185720id_/https://dados.mj.gov.br/dataset/0182f1bf-e73d-42b1-ae8c-fa94d9ce9451/resource/65706bcd-80ab-4231-a7ef-9e329420f001/download/basecompleta2025-03.zip)
- [Dicionário de dados](https://dados.mj.gov.br/dataset/0182f1bf-e73d-42b1-ae8c-fa94d9ce9451/resource/90aedbfe-3c91-4c18-86a5-f408d07e7210/download/dicionario-de-dados---consumidorgovbr-v3.pdf)
