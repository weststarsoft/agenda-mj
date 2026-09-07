# Agenda Mailza 11 — Vale do Juruá

App de agenda da campanha. O time abre no celular, vê o dia, o horário, o local e vai
direto pela rota. A coordenação altera e a mudança chega no aparelho de todos na hora.

Roda como PWA: instala na tela de início do celular, abre sem barra de navegador e
funciona sem sinal com a última agenda lida.

---

## O que você precisa

- Uma conta no Supabase (plano gratuito atende a campanha inteira)
- Uma conta na Vercel, Netlify ou Cloudflare Pages para publicar (também gratuito)
- 20 a 30 minutos

---

## Passo 1 — Criar o banco

1. Entre em `supabase.com`, crie um projeto. Anote a senha do banco.
   Escolha a região **South America (São Paulo)** — menos atraso no Acre.
2. No menu lateral, abra **SQL Editor** e clique em *New query*.
3. Cole todo o conteúdo de `supabase/01_schema.sql` e execute (*Run*).
4. Abra outra query, cole `supabase/02_seed.sql` e execute. Isso carrega os
   44 compromissos de 7 a 13 de setembro já extraídos da logística do majoritário.

Confira em **Table Editor > events** se as linhas estão lá.

## Passo 2 — Criar o login da coordenação

1. Menu **Authentication > Users > Add user > Create new user**.
2. Preencha e-mail e senha de quem vai editar. Marque *Auto Confirm User*.
3. Repita para cada pessoa da coordenação que precisa alterar a agenda.

Quem não tem conta consegue ver tudo, mas não altera nada. Isso é garantido no banco
pelas políticas de RLS, não pelo aplicativo — não tem como burlar pela tela.

Em **Authentication > Providers**, desligue *Enable email signup* para ninguém
criar conta por conta própria.

## Passo 3 — Ligar o app no banco

1. Menu **Project Settings > API**.
2. Copie **Project URL** e a chave **anon public**.
3. Abra `config.js` e cole nos dois campos.

A chave anon pode ficar visível no código: ela só lê a agenda.

## Passo 4 — Publicar

O caminho mais rápido, sem instalar nada:

1. Entre em `vercel.com`, faça login e escolha *Add New > Project > Deploy without Git*.
2. Arraste a pasta inteira deste projeto.
3. Em poucos segundos você recebe um endereço como `agenda-mailza.vercel.app`.

Se preferir domínio próprio (`agenda.mailza11.com.br`), aponte o DNS na Vercel em
*Settings > Domains*.

> Precisa ser HTTPS. É o que a Vercel, Netlify e Cloudflare já entregam por padrão.
> Sem HTTPS o PWA não instala e o app não funciona offline.

## Passo 5 — Instalar no celular do time

Mande o link no grupo com esta instrução:

- **Android (Chrome):** abrir o link, menu ⋮, *Adicionar à tela inicial*.
- **iPhone (Safari):** abrir o link, botão de compartilhar, *Adicionar à Tela de Início*.

Depois de instalado, abre como aplicativo, com o ícone rosa 11.

---

## Como o time usa

| O que aparece | Para que serve |
|---|---|
| Trilha de dias no topo | Toca no dia e vê a agenda daquele dia |
| Cartão "A seguir" | Mostra quanto tempo falta para o próximo compromisso |
| Google Maps / Waze | Abre a rota até o local exato |
| Filtros Rua, Reuniões, Mídia, Logística | Cada frente vê só o que interessa |
| Enviar agenda do dia | Gera o texto formatado para colar no grupo do WhatsApp |
| Cartão riscado com "Cancelada" | Agenda que não vai acontecer, com o motivo |

## Como a coordenação altera

1. Rodapé do app, botão **Gerenciar agenda**.
2. Entrar com o e-mail e senha criados no passo 2.
3. Na lista, cada compromisso tem dois botões: o círculo com X **cancela num toque**,
   o lápis abre o formulário completo.
4. **Nova agenda** para lançar compromisso; **Ver histórico** mostra quem mexeu no quê.

Cancelar não é o mesmo que excluir. Cancelar mantém o compromisso na tela, riscado,
com aviso para não se deslocar. Excluir apaga. Em campanha, quase sempre o certo é
cancelar: quem já saiu de casa precisa ver o aviso.

## Sem internet no meio do mato

Situação comum no Juruá. O app:

- abre com a última agenda que conseguiu ler, e avisa o horário dessa leitura;
- guarda alterações da coordenação numa fila e publica sozinho quando o sinal voltar;
- mostra no painel quantas alterações estão esperando.

## Colocar a latitude e longitude

Sem coordenada, os botões de rota fazem uma busca por texto ("Praça da COHAB,
Tarauacá, AC") e o Maps geralmente acerta. Em ramal, comunidade e ponto de rio,
convém precisar: abra o Google Maps no ponto, toque e segure para largar o alfinete,
copie os números e cole nos campos Latitude e Longitude do formulário.

---

## Estrutura dos arquivos

```
index.html              tela do app
app.js                  lógica, Supabase, cache offline, fila de envio
styles.css              identidade visual da campanha
config.js               suas chaves do Supabase (único arquivo a editar)
sw.js                   service worker: abre sem sinal
manifest.webmanifest    faz o app instalável
icons/                  ícones da tela de início
supabase/01_schema.sql  tabelas, permissões, histórico, realtime
supabase/02_seed.sql    a agenda de 7 a 13 de setembro
```

## Sobre notificação empurrada

Hoje o app avisa quando está aberto ou em segundo plano recente, com aviso na tela e
notificação do sistema quando o aparelho permite. Notificação que chega com o app
totalmente fechado precisa de servidor de push com chaves VAPID e, no iPhone, só
funciona se o app tiver sido instalado na tela de início. É um acréscimo de umas
duas horas sobre esta base — vale fazer se a campanha decidir que o aviso de
cancelamento tem que furar o bolso de quem está na rua.

## Segurança, em linguagem direta

- Leitura é pública: quem tiver o link vê a agenda. Trate o link como interno.
- Escrita exige conta. As regras estão no banco, com RLS.
- O histórico registra e-mail, ação e horário de cada alteração.
- Se alguém sair da campanha, apague o usuário em Authentication > Users.
- Não coloque no app informação que não pode circular: endereço residencial,
  telefone pessoal, valor de recurso. A agenda vai passar de celular em celular.
