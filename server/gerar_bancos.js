const fs = require('fs');
const path = require('path');

console.log("🔄 Gerando Bancos de Palavras (Completo vs Respostas)...");

// --- CONFIGURAÇÕES ---
const LIMITE_RESPOSTAS = 2500; // Apenas as 2500 mais comuns serão sorteadas
const ARQUIVO_FREQ = 'icf.txt';
const ARQUIVOS_BASE = ['lexico.txt', 'conjugacoes.txt', 'conjugacoes'];

// Palavras que OBRIGATORIAMENTE devem estar na lista de RESPOSTAS (VIP)
const VIP_RESPOSTAS = [
    "PODAM", "TRENS", "LUZES", "CASAS", "CORES", "ANEIS", 
    "MARES", "DORES", "FOGO", "VIDA", "AMOR", "TERMO", "AUDIO"
];
// ---------------------

let mapaCompleto = new Map();

// Função de normalização (para usar como chave de busca)
function normalizar(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

// 1. Carregar Base Completa (Léxico + Conjugações)
console.log("📚 Lendo dicionários e gerando plurais...");
ARQUIVOS_BASE.forEach(nome => {
    if (fs.existsSync(nome)) {
        const conteudo = fs.readFileSync(nome, 'utf-8');
        conteudo.split(/\s+/).forEach(bruta => {
            if (!bruta) return;
            
            // Limpa pontuação, mantém acento original
            let original = bruta.split('/')[0].replace(/[.,;:]/g, "").toUpperCase();
            let chave = normalizar(original);

            // Filtro Básico: 5 letras
            if (original.length === 5 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]+$/.test(original)) {
                if (!mapaCompleto.has(chave)) {
                    // Score padrão alto (ruim) - será melhorado se estiver no ICF
                    mapaCompleto.set(chave, { original: original, score: 100.0 }); 
                }
            }

            // Lógica de Plurais (TRENS, LUZES, CASAS)
            let plural = "";
            if (original.length === 4) {
                if (/[AEIOU]$/.test(original)) plural = original + "S";
                if (original.endsWith("M")) plural = original.slice(0, -1) + "NS";
                if (original.endsWith("L")) plural = original.slice(0, -1) + "IS";
            }
            if (original.length === 3 && /[RZ]$/.test(original)) plural = original + "ES";

            if (plural.length === 5) {
                let chavePlural = normalizar(plural);
                if (!mapaCompleto.has(chavePlural)) {
                    mapaCompleto.set(chavePlural, { original: plural, score: 90.0 });
                }
            }
        });
    }
});

// 2. Aplicar Frequência (ICF)
if (fs.existsSync(ARQUIVO_FREQ)) {
    console.log("📊 Aplicando pontuação de frequência...");
    const dadosICF = fs.readFileSync(ARQUIVO_FREQ, 'utf-8');
    dadosICF.split('\n').forEach(linha => {
        const partes = linha.trim().split(/[\s,]+/);
        if (partes.length >= 2) {
            let chave = normalizar(partes[0]);
            let score = parseFloat(partes[1]);
            
            if (mapaCompleto.has(chave) && !isNaN(score)) {
                mapaCompleto.get(chave).score = score;
            }
        }
    });
}

// 3. Separar as Listas
let listaTodosObj = Array.from(mapaCompleto.values());

// Lista 1: COMPLETA (Só ordena alfabeticamente)
let bancoCompleto = listaTodosObj.map(item => item.original).sort((a, b) => normalizar(a).localeCompare(normalizar(b)));

// Lista 2: RESPOSTAS (Filtra por score + VIPs)
// Ordena por score (menor = mais comum)
listaTodosObj.sort((a, b) => a.score - b.score);

// Pega as top X mais comuns
let candidatosRespostas = listaTodosObj.slice(0, LIMITE_RESPOSTAS).map(item => item.original);

// Garante que os VIPs entrem na lista de respostas
VIP_RESPOSTAS.forEach(vip => {
    if (!candidatosRespostas.includes(vip) && mapaCompleto.has(normalizar(vip))) {
        candidatosRespostas.push(mapaCompleto.get(normalizar(vip)).original);
    }
});
// Ordena alfabeticamente a lista de respostas
let bancoRespostas = candidatesRespostas = candidatosRespostas.sort((a, b) => normalizar(a).localeCompare(normalizar(b)));

// 4. Salvar Arquivos
if (bancoCompleto.length > 0) {
    fs.writeFileSync('banco_completo.json', JSON.stringify(bancoCompleto)); // Validação
    fs.writeFileSync('banco_respostas.json', JSON.stringify(bancoRespostas)); // Palavra do Dia
    
    console.log("\n✅ SUCESSO!");
    console.log(`📂 'banco_completo.json': ${bancoCompleto.length} palavras (Para validar digitação)`);
    console.log(`📂 'banco_respostas.json': ${bancoRespostas.length} palavras (Para sortear)`);
    
    console.log("\n🔎 Teste de Respostas (Palavra do dia):");
    console.log(`   - PODAM: ${bancoRespostas.includes("PODAM") ? "✅" : "❌"}`);
    console.log(`   - ÁGUA:  ${bancoRespostas.includes("ÁGUA") ? "✅" : "❌"}`);
    
    console.log("\n🔎 Teste de Input (Pode digitar):");
    console.log(`   - Palavra rara (AARON): ${bancoCompleto.includes("AARON") ? "✅" : "❌"}`);
}