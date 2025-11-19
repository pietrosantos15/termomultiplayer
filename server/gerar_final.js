const fs = require('fs');
const path = require('path');

console.log("🔄 Gerando Dicionário Definitivo (Com Acentos e 'PODAM')...");

// --- CONFIGURAÇÕES ---
const LIMITE_PALAVRAS = 6000; // Aumentei para 6000 para garantir que verbos conjugados entrem
const ARQUIVO_FREQ = 'icf.txt';
const ARQUIVOS_BASE = ['lexico.txt', 'conjugacoes.txt', 'conjugacoes'];

// Lista VIP: Palavras que DEVEM entrar independente da pontuação ou erro do ICF
const PALAVRAS_VIP = new Set([
    "PODAM", "TRENS", "LUZES", "CASAS", "CORES", "ANEIS", 
    "MARES", "DORES", "FOGO", "VIDA", "AMOR"
]);
// ---------------------

// Mapa principal: Chave = Normalizada (AGUA), Valor = Objeto { original: "Água", score: 999 }
let mapaPalavras = new Map();

// Função auxiliar de normalização (apenas para busca, não altera a original)
function normalizar(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

// 1. Carregar Léxico e Conjugações (Mantendo acentos!)
console.log("📚 Lendo dicionários...");
ARQUIVOS_BASE.forEach(nome => {
    if (fs.existsSync(nome)) {
        const conteudo = fs.readFileSync(nome, 'utf-8');
        conteudo.split(/\s+/).forEach(bruta => {
            if (!bruta) return;
            
            // Limpa sujeira (pontos, vírgulas)
            let original = bruta.split('/')[0].replace(/[.,;:]/g, "").toUpperCase();
            let chave = normalizar(original);

            // Filtro básico: 5 letras (contando caracteres especiais como 1 letra)
            if (original.length === 5 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]+$/.test(original)) {
                // Se já existe, mantemos o que já está (geralmente lexico tem prioridade) ou sobrescrevemos
                if (!mapaPalavras.has(chave)) {
                    mapaPalavras.set(chave, { original: original, score: 20.0 }); // Score padrão "médio"
                }
            }

            // Geração de Plurais (Aplicado na palavra original para manter acento se possível)
            // Nota: Plurais simples (vogal+s) funcionam bem. "M"->"NS" perde acento se tiver, mas "TREM" não tem.
            let plural = "";
            if (original.length === 4) {
                if (/[AEIOU]$/.test(original)) plural = original + "S"; // CASA -> CASAS
                if (original.endsWith("M")) plural = original.slice(0, -1) + "NS"; // TREM -> TRENS
                if (original.endsWith("L")) plural = original.slice(0, -1) + "IS"; // ANEL -> ANEIS
            }
            if (original.length === 3 && /[RZ]$/.test(original)) plural = original + "ES"; // LUZ -> LUZES

            if (plural.length === 5) {
                let chavePlural = normalizar(plural);
                if (!mapaPalavras.has(chavePlural)) {
                    mapaPalavras.set(chavePlural, { original: plural, score: 15.0 }); // Score bom para plurais
                }
            }
        });
    }
});

// 2. Aplicar Pontuação do ICF (Frequência)
if (fs.existsSync(ARQUIVO_FREQ)) {
    console.log("📊 Aplicando filtro de frequência...");
    const dadosICF = fs.readFileSync(ARQUIVO_FREQ, 'utf-8');
    dadosICF.split('\n').forEach(linha => {
        const partes = linha.trim().split(/[\s,]+/);
        if (partes.length >= 2) {
            let palavraICF = partes[0];
            let score = parseFloat(partes[1]);
            let chave = normalizar(palavraICF);

            // Se a palavra existe no nosso dicionário, atualizamos o score dela
            if (mapaPalavras.has(chave) && !isNaN(score)) {
                let obj = mapaPalavras.get(chave);
                obj.score = score;
                // Se a palavra no ICF tiver acento e a nossa não, ou vice versa, 
                // geralmente confiamos na nossa lista base (lexico), então não mudamos o 'original'.
            }
        }
    });
}

// 3. Forçar Palavras VIP (Score 0 = Prioridade Máxima)
PALAVRAS_VIP.forEach(vip => {
    let chave = normalizar(vip);
    if (mapaPalavras.has(chave)) {
        mapaPalavras.get(chave).score = 0;
    } else {
        // Se não existia (ex: PODAM foi deletado por algum motivo), cria na marra
        mapaPalavras.set(chave, { original: vip, score: 0 });
    }
});

// 4. Transformar em Lista, Ordenar e Cortar
let listaFinal = Array.from(mapaPalavras.values());

// Ordena: Menor score (mais comum) -> Maior score (mais rara)
listaFinal.sort((a, b) => a.score - b.score);

// Pega as TOP X
let melhores = listaFinal.slice(0, LIMITE_PALAVRAS).map(obj => obj.original).sort();

// 5. Salvar
if (melhores.length > 0) {
    fs.writeFileSync('palavras.json', JSON.stringify(melhores));
    console.log(`\n✅ SUCESSO! 'palavras.json' gerado com ${melhores.length} palavras.`);
    console.log("---------------------------------------------------");
    console.log("🔎 Verificação de Qualidade:");
    console.log(`   - PODAM:  ${melhores.includes("PODAM") ? "✅ Presente" : "❌ Faltou"}`);
    console.log(`   - TRENS:  ${melhores.includes("TRENS") ? "✅ Presente" : "❌ Faltou"}`);
    console.log(`   - LUZES:  ${melhores.includes("LUZES") ? "✅ Presente" : "❌ Faltou"}`);
    console.log(`   - ÁGUA (com acento): ${melhores.includes("ÁGUA") ? "✅ Presente" : "❌ Faltou (verifique se está AGUA)"}`);
    console.log(`   - OUÇAM (com cedilha): ${melhores.includes("OUÇAM") ? "✅ Presente" : "❌ Faltou"}`);
    console.log("---------------------------------------------------");
} else {
    console.error("❌ Erro: Nenhuma palavra gerada.");
}