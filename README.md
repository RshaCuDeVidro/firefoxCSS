# PWND — tema de Firefox (userChrome + userChrome.js)

Tema neon (fuchsia/ciano sobre preto) para **Firefox 153**, com features feitas em
`userChrome.css` / `userContent.css` e em scripts `userChrome.js` carregados pelo
loader [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig).

> Os arquivos deste repositório são o conteúdo da pasta `chrome/` do perfil.
> O `user.js` do repositório vai na **raiz do perfil** (não dentro de `chrome/`).

## Requisitos

- Firefox 153 (validado). Versões bem diferentes podem exigir ajustes.
- `toolkit.legacyUserProfileCustomizations.stylesheets = true` no `about:config`.
- Loader fx-autoconfig (já incluído em `utils/`; o script de instalação publica
  o `config.js` no diretório do Firefox).
- Linux: o script assume `/usr/lib/firefox` e `/usr/lib64/firefox`.

## Instalação

1. Descubra o perfil: `about:support` → **Profile Folder**.
2. Clone o repositório como `chrome` e copie o `user.js`:

   ```bash
   cd /caminho/do/perfil
   git clone https://github.com/RshaCuDeVidro/firefoxCSS.git chrome
   cp chrome/user.js user.js
   ```

3. Instale o loader (pede a senha do sudo):

   ```bash
   sudo bash chrome/install-fx-autoconfig.sh
   ```

4. Reinicie o Firefox e, em `about:support`, clique em **Clear startup cache**.
5. Confirme no `about:config`:
   - `general.config.filename = config.js`
   - `userChromeJS.experimental.enabled = true` (necessário para o actor)
6. Abra o Browser Console (`Ctrl+Shift+J`) — devem aparecer as linhas
   `[pwnd] ... carregado`.

## Estrutura

```
.
├── userChrome.css            tema do chrome (tokens, tabs, urlbar, paineis...)
├── userContent.css           about:*, scrollbars, selecao de texto
├── user.js                   prefs (vai na raiz do perfil)
├── install-fx-autoconfig.sh  instalador do loader (sudo)
├── fx-autoconfig/            config.js + config-prefs.js que vao pro Firefox
├── JS/                       scripts userChrome.js
│   ├── probe_toolkit.uc.js       regua / medir / cor / seletor / spotlight
│   ├── selection_chip.uc.js      chip ao selecionar texto
│   ├── page_outline.uc.js        indice flutuante (outline)
│   ├── scroll_chrome.uc.js       esconde a toolbar ao descer a pagina
│   ├── mouse_gestures.uc.js      gestos com botao direito + trilha
│   ├── dynamic_accent.uc.js      accent derivado do favicon da aba
│   ├── time_theme.uc.js          hue ambiente muda conforme a hora
│   ├── crt_idle.uc.js            screensaver CRT apos ocioso
│   ├── kill_close.uc.js          animacao "process killed" ao fechar aba
│   ├── element_probe_register.sys.mjs  registra o WindowActor
│   ├── ElementProbe/             actor (child/parent) que fala com a pagina
│   └── buffer_numbers.uc.js.disabled   fallback dos numeros de aba (JS)
└── utils/                    loader fx-autoconfig 0.10.16
```

## Features

### Tema
- Dual-tone: fuchsia para interacao, ciano para estado/informacao.
- Chrome reativo: a borda da toolbar muda com o estado da pagina
  (seguro = ciano, inseguro/erro = vermelho, carregando = ambar, digitando = fuchsia).
- Dark-room: so o favicon da aba ativa tem cor; as inativas ficam dessaturadas.
- Drift por hora do dia (`time_theme`): manha = ciano, tarde = fuchsia,
  noite = violeta/azul, madrugada = quase mono.
- Accent dinamico (`dynamic_accent`): a cor de destaque vem do favicon da aba ativa,
  com fallback deterministico por hostname.

### Regua e inspecao (segure `Shift+Alt`)
| acao | resultado |
| --- | --- |
| mover o mouse | faixa de leitura seguindo o cursor |
| arrastar | caixa de medicao com `W × H` |
| clique curto | copia **hex + rgb** do pixel |
| `Ctrl` + clique curto | copia o **seletor CSS** do elemento |
| `Shift+Alt+E` | liga/desliga o **spotlight de elemento** (badge `tag#id.class W×H`; clique copia o seletor; `Esc` sai) |
| `Shift+Alt+T` | abre/fecha o **outline** da pagina (headings, secao atual, clique pula) |

### Gestos (botao direito + arrastar, com trilha neon)
| gesto | acao |
| --- | --- |
| `L` / `R` | voltar / avancar |
| `U` / `D` | topo / fim da pagina |
| `DR` | fechar aba |
| `UD` | recarregar |
| `DU` | duplicar aba |
| `LR` | nova aba |
| `RL` | reabrir aba fechada |

### Outros
- **Chip de selecao**: ao selecionar texto aparece `N palavras · ~Xs` com
  `copiar`, `citar` (Markdown + link), `buscar` e `traduzir`.
- **Scroll chrome**: descendo a pagina, toolbar/abas saem de cena; subindo (ou
  encostando o mouse nos 6px do topo) elas voltam.
- **Screensaver CRT**: apos 120s ocioso, overlay com scanlines/vinheta e
  `[ IDLE ]`; qualquer atividade acorda com um flash.
- **Killed close**: aba fechada pisca em vermelho e colapsa.
- **Numeros de aba**: `numbered_tabs` via CSS counter (1..N).
- **Barra de progresso** no rodape da aba + **linha quicando** no topo durante
  o carregamento (substituem o throbber).
- **Animacao de fechamento** de aba mais visivel.

## Personalizacao

- Cores/tokens: bloco `:root` no topo do `userChrome.css` (`--p-*`).
- Tempo do screensaver: `THRESHOLD` em `JS/crt_idle.uc.js` (segundos).
- Mapa de gestos: objeto `ACTIONS` em `JS/mouse_gestures.uc.js`.
- Se os numeros de aba nao aparecerem, reative o fallback:

  ```bash
  mv JS/buffer_numbers.uc.js.disabled JS/buffer_numbers.uc.js
  ```

## Notas

- O spotlight/outline/gestos usam um `WindowActor` proprio (`ElementProbe`),
  registrado por `JS/element_probe_register.sys.mjs`. Ele exige
  `userChromeJS.experimental.enabled = true` (o `user.js` do repo liga isso).
- A amostragem de cor usa `drawSnapshot`; em paginas protegidas (DRM) ela falha
  de forma silenciosa (o toast avisa).
- Gestos com botao direito podem conflitar com sites que usam right-drag; o menu
  de contexto so e suprimido quando um gesto e de fato desenhado.

## Creditos e licencas

- [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) — MrOtherGuy, MPL 2.0 (em `utils/`, `fx-autoconfig/`).
- [firefox-csshacks](https://github.com/MrOtherGuy/firefox-csshacks) — MrOtherGuy, MPL 2.0:
  `numbered_tabs`, `tab_loading_progress_bar`, `loading_indicator_bouncing_line`
  e `tab_closing_animation`, adaptados no `userChrome.css`.
