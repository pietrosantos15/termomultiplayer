const fs = require('fs');
const path = require('path');

console.log("🔄 Iniciando a geração do Dicionário Balanceado (80/20)...");

// --- CONFIGURAÇÃO ---
const LIMITE_PALAVRAS = 5000; // Pega apenas as 5000 mais comuns (corta as raras/estranhas)
const ARQUIVO_FREQ = 'icf.txt';
const ARQUIVOS_BASE = ['lexico.txt', 'conjugacoes.txt', 'conjugacoes'];
// --------------------

// Conjunto de palavras base (Léxico + Conjugações + Plurais Gerados)
let palavrasCandidatas = new Set();

// 1. Função para gerar plurais (Traz de volta TRENS, LUZES, etc)
function tentarGerarPlurais(palavra) {
    const p = palavra;
    // Regra: M -> NS (TREM -> TRENS)
    if (p.length === 4 && p.endsWith("M")) palavrasCandidatas.add(p.slice(0, -1) + "NS");
    // Regra: R/Z -> ES (COR -> CORES, LUZ -> LUZES)
    if (p.length === 3 && /[RZ]$/.test(p)) palavrasCandidatas.add(p + "ES");
    // Regra: Vogal -> S (CASA -> CASAS)
    if (p.length === 4 && /[AEIOU]$/.test(p)) palavrasCandidatas.add(p + "S");
    // Regra: L -> IS (ANEL -> ANEIS)
    if (p.length === 4 && p.endsWith("L")) palavrasCandidatas.add(p.slice(0, -1) + "IS");
}

// 2. Carregar Base de Palavras
console.log("📚 Carregando dicionários e gerando plurais...");
ARQUIVOS_BASE.forEach(nome => {
    if (fs.existsSync(nome)) {
        const conteudo = fs.readFileSync(nome, 'utf-8');
        conteudo.split(/\s+/).forEach(bruta => {
            if (!bruta) return;
            let p = bruta.split('/')[0].replace(/[.,;:]/g, "");
            let limpa = p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            
            // Se for válida, adiciona
            if (/^[A-Z]+$/.test(limpa)) {
                if (limpa.length === 5) palavrasCandidatas.add(limpa);
                // Tenta gerar plural a partir de palavras menores
                if (limpa.length >= 3 && limpa.length <= 4) tentarGerarPlurais(limpa);
            }
        });
    }
});

// 3. Ler ICF e aplicar pontuação (Menor pontuação = Mais comum)
let palavrasComScore = [];

if (fs.existsSync(ARQUIVO_FREQ)) {
    console.log("📊 Lendo frequências e filtrando...");
    const conteudoFreq = fs.readFileSync(ARQUIVO_FREQ, 'utf-8');
    const linhas = conteudoFreq.split('\n');

    linhas.forEach(linha => {
        // Formato esperado: "palavra score" ou "palavra,score"
        // Ex: "que 3.02" ou "abater 12.5"
        const partes = linha.trim().split(/[\s,]+/); 
        
        if (partes.length >= 2) {
            let palavra = partes[0].trim();
            let score = parseFloat(partes[1]); // O número da frequência

            let limpa = palavra.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

            // Só aceita se:
            // 1. Tiver 5 letras
            // 2. Estiver na nossa lista de palavras válidas (Candidatas)
            // 3. O score for um número válido
            if (limpa.length === 5 && palavrasCandidatas.has(limpa) && !isNaN(score)) {
                palavrasComScore.push({ palavra: limpa, score: score });
            }
        }
    });
} else {
    console.error("❌ ERRO CRÍTICO: Arquivo 'icf.txt' não encontrado!");
}

// 4. Ordenar: As mais comuns (menor score) primeiro
// O ICF funciona assim: Quanto MENOR o número, MAIS COMUM é a palavra.
palavrasComScore.sort((a, b) => a.score - b.score);

// 5. Selecionar apenas as TOP X palavras (Corte de qualidade)
// Isso remove automaticamente as palavras "estranhas" que ficam no final da lista com score alto.
const listaFinal = palavrasComScore.slice(0, LIMITE_PALAVRAS).map(item => item.palavra);

// 6. Garantia de Plurais Essenciais
// Caso o ICF não tenha "TRENS" listado com score, forçamos a entrada dele se ele foi gerado nas candidatas.
const essenciais = ["TRENS", "CASAS", "LUZES", "CORES", "ANEIS", "MARES"];
essenciais.forEach(p => {
    if (palavrasCandidatas.has(p) && !listaFinal.includes(p)) {
        listaFinal.unshift(p); // Adiciona no começo pra garantir
    }
});

// 7. Salvar
if (listaFinal.length > 0) {
    // Ordena alfabeticamente para salvar bonitinho
    listaFinal.sort(); 
    fs.writeFileSync('palavras.json', JSON.stringify(listaFinal));
    console.log(`\n✅ SUCESSO! Dicionário filtrado gerado com ${listaFinal.length} palavras.`);
    console.log("---------------------------------------------------");
    console.log("🔎 Teste de Qualidade:");
    console.log(`   - TRENS (Plural): ${listaFinal.includes("TRENS") ? "OK" : "AUSENTE"}`);
    console.log(`   - LUZES (Plural): ${listaFinal.includes("LUZES") ? "OK" : "AUSENTE"}`);
    console.log(`   - PODAM (Verbo):  ${listaFinal.includes("PODAM") ? "OK" : "AUSENTE"}`);
    console.log(`   - DAIRA (Rara):   ${listaFinal.includes("DAIRA") ? "ENTROU (Aumente o filtro)" : "REMOVIDA (Sucesso)"}`);
    console.log("---------------------------------------------------");
} else {
    console.error("❌ Falha: Nenhuma palavra restou após o filtro.");
}