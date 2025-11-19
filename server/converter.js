const fs = require('fs');

try {
    console.log("Lendo arquivo 'lexico.txt'...");
    // MUDANÇA AQUI: Agora lê lexico.txt
    const rawData = fs.readFileSync('lexico.txt', 'utf-8');
    
    const lines = rawData.split('\n');
    const words = new Set(); 

    lines.forEach(line => {
        // Pega a palavra antes da barra (ex: "casa/S" -> "casa")
        let word = line.split('/')[0].trim();
        
        if (word.length === 5) {
            // Remove acentos
            word = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            // Coloca em maiúsculo
            word = word.toUpperCase();
            
            // Verifica se sobrou apenas letras de A-Z
            if (/^[A-Z]{5}$/.test(word)) {
                words.add(word);
            }
        }
    });

    const finalArray = Array.from(words);
    fs.writeFileSync('palavras.json', JSON.stringify(finalArray));
    
    console.log(`SUCESSO! ${finalArray.length} palavras foram salvas em 'palavras.json'.`);

} catch (error) {
    console.error("Erro:", error.message);
    console.log("Dica: Verifique se o arquivo 'lexico.txt' está mesmo dentro da pasta server.");
}