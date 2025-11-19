const fs = require('fs');
const path = require('path');

console.log("🔄 Iniciando a criação do Dicionário Completo (Com Plurais)...");

const arquivosParaLer = [
    'lexico', 'lexico.txt',
    'conjugações', 'conjugacoes.txt', 'conjugacoes'
];

const palavrasFinais = new Set();

// Função para limpar e normalizar a palavra
function limparPalavra(p) {
    return p.split('/')[0]
            .replace(/[.,;:]/g, "")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Tira acentos
            .toUpperCase();
}

// Função inteligente para criar plurais
function tentarGerarPlurais(palavraSingular) {
    const p = palavraSingular;
    const len = p.length;
    
    // Regra 1: Palavras de 4 letras terminadas em vogal -> Adiciona S (CASA -> CASAS)
    if (len === 4 && /[AEIOU]$/.test(p)) {
        adicionarSeValida(p + "S");
    }

    // Regra 2: Palavras de 4 letras terminadas em M -> Tira M e põe NS (TREM -> TRENS)
    if (len === 4 && p.endsWith("M")) {
        adicionarSeValida(p.slice(0, -1) + "NS");
    }

    // Regra 3: Palavras de 4 letras terminadas em L -> Tira L e põe IS (ANEL -> ANEIS, AZUL -> AZUIS)
    if (len === 4 && p.endsWith("L")) {
        // Exceção: MAL -> MALES (não entra aqui pois vira 5 letras com regra diferente, mas ignoraremos exceções raras)
        adicionarSeValida(p.slice(0, -1) + "IS");
    }

    // Regra 4: Palavras de 3 letras terminadas em R ou Z -> Adiciona ES (COR -> CORES, LUZ -> LUZES)
    if (len === 3 && /[RZ]$/.test(p)) {
        adicionarSeValida(p + "ES");
    }
    
    // Regra 5: Palavras de 3 letras terminadas em S (monossílabos) -> Adiciona ES (GÁS -> GASES)
    if (len === 3 && p.endsWith("S")) {
        adicionarSeValida(p + "ES");
    }
}

function adicionarSeValida(palavra) {
    if (palavra.length === 5 && /^[A-Z]+$/.test(palavra)) {
        palavrasFinais.add(palavra);
    }
}

arquivosParaLer.forEach(nomeArquivo => {
    const caminho = path.join(__dirname, nomeArquivo);
    
    if (fs.existsSync(caminho)) {
        console.log(`📖 Processando: ${nomeArquivo}...`);
        try {
            const conteudo = fs.readFileSync(caminho, 'utf-8');
            const linhas = conteudo.split(/\s+/);
            
            linhas.forEach(bruta => {
                if (!bruta) return;
                const limpa = limparPalavra(bruta);

                // 1. Se a palavra original já tem 5 letras, adiciona.
                adicionarSeValida(limpa);

                // 2. Tenta criar o plural dela (se ela for menor, o plural pode ter 5)
                tentarGerarPlurais(limpa);
            });
        } catch (erro) {
            console.error(`❌ Erro em ${nomeArquivo}:`, erro.message);
        }
    }
});

const listaOrdenada = Array.from(palavrasFinais).sort();

if (listaOrdenada.length > 0) {
    fs.writeFileSync(path.join(__dirname, 'palavras.json'), JSON.stringify(listaOrdenada));
    console.log(`\n✅ SUCESSO! Dicionário expandido com ${listaOrdenada.length} palavras.`);
    
    // Testes de verificação
    const testes = ["TRENS", "LUZES", "CASAS", "ANEIS", "CORES"];
    console.log("\n🔎 Verificando palavras novas:");
    testes.forEach(t => {
        console.log(`   - ${t}: ${palavrasFinais.has(t) ? "OK ✅" : "FALTOU ❌"}`);
    });

} else {
    console.error("❌ Nenhuma palavra gerada.");
}