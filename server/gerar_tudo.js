const fs = require('fs');

console.log("🚀 Iniciando processamento do dicionário completo...");

try {
    // Lê o arquivo lexico.txt
    const rawData = fs.readFileSync('lexico.txt', 'utf-8');
    const lines = rawData.split('\n');
    
    const todasPalavras = new Set(); // Usamos Set para eliminar duplicatas automaticamente

    lines.forEach(line => {
        if (!line) return;

        // O formato do arquivo é "palavra/flags" (ex: correr/v)
        // Pegamos apenas a parte antes da barra
        let word = line.split('/')[0].trim();

        // Remove acentos (Normalização NFD)
        // Ex: "ÁGUA" vira "AGUA", "AÇÕES" vira "ACOES"
        let cleanWord = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Se a palavra limpa tiver exatamente 5 letras
        if (cleanWord.length === 5) {
            cleanWord = cleanWord.toUpperCase();

            // Verifica se a palavra contém APENAS letras de A a Z (sem hífens ou números)
            if (/^[A-Z]{5}$/.test(cleanWord)) {
                todasPalavras.add(cleanWord);
            }
        }
    });

    // Transforma o Set em Array e ordena alfabeticamente
    const finalArray = Array.from(todasPalavras).sort();

    // Salva o arquivo JSON
    fs.writeFileSync('palavras.json', JSON.stringify(finalArray));
    
    console.log(`✅ SUCESSO!`);
    console.log(`📚 Total de palavras de 5 letras encontradas: ${finalArray.length}`);
    console.log(`💾 Arquivo salvo como: server/palavras.json`);

} catch (error) {
    console.error("❌ Erro:", error.message);
    console.log("Dica: Tenha certeza que o arquivo 'lexico.txt' está na pasta server.");
}