# testing_area — fichas novas por validar

Fichas que faltavam, no mesmo formato das publicadas. Depois de validadas, carrega o PDF na área do
professor (nível e tema = as pastas onde a ficha está).

```bash
./build.sh                       # compila todas
./build.sh basico/fracoes/*.tex  # só algumas
```

O estilo comum está em `ficha.sty` (título, instruções, `\secao{Título}{Instrução}` e a lista `exercicios`).
O PDF fica ao lado do `.tex`; os ficheiros auxiliares vão para `.build/`.

Tópicos excluídos de propósito: numeração romana, múltiplos, divisores, primos, m.d.c./m.m.c. e arredondamentos.

## Básico

| Tema (pasta) | Ficha | Sequência |
|---|---|---|
| calculo-numerico | numeros-e-reta-numerica | 1–2 |
| calculo-numerico | prioridade-das-operacoes | 6–7 |
| calculo-numerico | numeros-inteiros | 11–12 |
| calculo-numerico | potencias-e-raizes | 13 |
| fracoes | fracoes-improprias-e-numerais-mistos | 15 |
| fracoes | operacoes-com-decimais | 19 |
| fracoes | numeros-racionais | 20 |
| fracoes | potencias-e-notacao-cientifica | 22 |
| percentagens | proporcionalidade-direta-e-escalas | 26 |
| percentagens | juros-simples-e-velocidade-media | 27 |
| algebra-essencial | sequencias-e-regularidades | 28 |
| algebra-essencial | monomios-e-polinomios | 29 |
| algebra-essencial | numeros-reais | 32 |
| algebra-essencial | casos-notaveis-e-fatorizacao | 34 |
| algebra-essencial | sistemas-de-equacoes | 37 |
| algebra-essencial | funcoes-linear-e-afim | 38–39 |
| algebra-essencial | proporcionalidade-inversa-e-funcao-quadratica | 40–41 |
| geometria | angulos-e-retas-paralelas | 42–43 |
| geometria | unidades-de-medida | 45 |
| geometria | isometrias-e-vetores | 49 |
| geometria | lugares-geometricos-e-pontos-notaveis | 52 |
| geometria | angulos-na-circunferencia | 53 |
| geometria | solidos-e-planificacoes | 54 |
| estatistica | histogramas-e-quartis | 60 |
| estatistica | conjuntos-e-diagramas-de-venn | 61 |
| estatistica | tabelas-de-dupla-entrada-e-arvores | 63 |

## Secundário

| Tema (pasta) | Ficha | Sequência |
|---|---|---|
| logica | logica-e-demonstracao | 64 |
| radicais-polinomios | radicais-e-potencias-de-expoente-racional | 65 |
| funcoes | composicao-e-funcao-inversa | 68 |
| funcoes | transformacoes-de-graficos | 69 |
| funcoes | quadratica-modulo-e-ramos | 70 |
| funcoes | funcoes-racionais | 71 |
| geometria-analitica | geometria-analitica-no-plano | 72–73 |
| geometria-analitica | vetores-e-geometria-no-espaco | 74, 78–79 |
| trigonometria | lei-dos-senos-e-dos-cossenos | 75 |
| trigonometria | circulo-trigonometrico-e-funcoes | 76 |
| trigonometria | equacoes-trigonometricas | 77 |
| sucessoes-progressoes | sucessoes-inducao-e-progressoes | 80 |
| limites | limites-de-sucessoes | 81 |
| limites | limites-de-funcoes-e-continuidade | 82, 88–89 |
| derivadas | derivada-e-regras-de-derivacao | 83 |
| derivadas | monotonia-extremos-e-otimizacao | 84 |
| derivadas | derivadas-e-estudo-de-funcoes | 90–91 |
| exponenciais-logaritmos | funcao-exponencial-e-juros-compostos | 85 |
| exponenciais-logaritmos | logaritmos-equacoes-e-modelos | 86–87 |
| numeros-complexos | complexos-forma-algebrica | 92 |
| numeros-complexos | complexos-forma-trigonometrica | 93–94 |
| estatistica | variancia-correlacao-e-regressao | 95–96 |
| combinatoria-probabilidades | combinatoria-e-binomio-de-newton | 97–98 |
| combinatoria-probabilidades | probabilidades-e-distribuicoes | 99–100 |
