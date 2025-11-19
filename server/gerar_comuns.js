const fs = require('fs');
const path = require('path');

console.log("🔄 Gerando dicionário de palavras COMUNS (5 letras)...");

// 1. Carregar TODAS as palavras válidas (Léxico + Conjugações)
// Isso serve para garantir que não vamos pegar "lixo" do arquivo de frequência
let palavrasValidas = new Set();
const arquivosBase = ['lexico.txt', 'conjugacoes.txt', 'conjugacoes'];

arquivosBase.forEach(nome => {
    if (fs.existsSync(nome)) {
        const conteudo = fs.readFileSync(nome, 'utf-8');
        conteudo.split(/\s+/).forEach(bruta => {
            if (!bruta) return;
            let p = bruta.split('/')[0].replace(/[.,;:]/g, "");
            let limpa = p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            if (limpa.length === 5 && /^[A-Z]+$/.test(limpa)) {
                palavrasValidas.add(limpa);
            }
        });
    }
});
console.log(`📚 Base de dados: ${palavrasValidas.size} palavras válidas encontradas.`);

// 2. Filtrar usando o arquivo de frequência (icf.txt)
const palavrasFinais = new Set();
const ARQUIVO_FREQ = 'icf.txt'; // Agora com o nome certo!

if (fs.existsSync(ARQUIVO_FREQ)) {
    console.log(`📊 Lendo arquivo de frequência: ${ARQUIVO_FREQ}...`);
    const conteudoFreq = fs.readFileSync(ARQUIVO_FREQ, 'utf-8');
    const linhas = conteudoFreq.split('\n');

    let contador = 0;
    linhas.forEach(linha => {
        // O formato do ICF geralmente é "palavra  frequencia" ou "palavra,frequencia"
        // Vamos tentar pegar a primeira parte da linha
        const partes = linha.trim().split(/\s+|,/); 
        
        if (partes.length >= 1) {
            let palavra = partes[0].trim();
            let limpa = palavra.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

            // A MÁGICA: Só aceita se tiver 5 letras E se existir no dicionário oficial
            if (limpa.length === 5 && /^[A-Z]+$/.test(limpa) && palavrasValidas.has(limpa)) {
                palavrasFinais.add(limpa);
                contador++;
            }
        }
    });
} else {
    console.error(`❌ ERRO: O arquivo '${ARQUIVO_FREQ}' não foi encontrado na pasta server.`);
}

// 3. Adicionar plurais manuais importantes que as vezes faltam no ICF
// (Opcional, mas ajuda a garantir palavras básicas)
const basicas = ["TRENS", "CASAS", "LUZES", "CORES", "ANEIS", "MARES", "DORES"];
basicas.forEach(p => {
    if (palavrasValidas.has(p)) palavrasFinais.add(p);
});

// 4. Salvar
const listaFinal = Array.from(palavrasFinais).sort();

if (listaFinal.length > 0) {
    fs.writeFileSync('palavras.json', JSON.stringify(listaFinal));
    console.log(`\n✅ SUCESSO! Novo 'palavras.json' gerado com ${listaFinal.length} palavras comuns.`);
    console.log("Exemplos:", listaFinal.slice(0, 15));
} else {
    console.error("❌ Nenhuma palavra gerada. Verifique se 'lexico.txt', 'conjugacoes.txt' e 'icf.txt' estão na pasta.");
}