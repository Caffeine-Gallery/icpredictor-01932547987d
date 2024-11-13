import { backend } from "declarations/backend";

let priceChart;
let currentCoin = 'ICP';

async function fetchCryptoPrice(coin) {
    const coinId = coin === 'ICP' ? 'internet-computer' : 'bitcoin';
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`);
    const data = await response.json();
    return {
        price: data[coinId].usd,
        change24h: data[coinId].usd_24h_change
    };
}

async function updateUI() {
    await Promise.all([updateCoinData('ICP'), updateCoinData('BTC')]);
    await updateChart(currentCoin);
    await updateHistory(currentCoin);
}

async function updateCoinData(coin) {
    const loading = document.getElementById(`loading${coin}`);
    loading.classList.remove('d-none');

    try {
        const priceData = await fetchCryptoPrice(coin);
        const recommendation = await backend.getTradeRecommendation(coin, priceData.price, priceData.change24h);
        
        document.getElementById(`currentPrice${coin}`).textContent = 
            `$${priceData.price.toFixed(2)} (${priceData.change24h.toFixed(2)}%)`;
        
        const recommendationElement = document.getElementById(`recommendation${coin}`);
        recommendationElement.textContent = recommendation;
        recommendationElement.className = `recommendation-text ${recommendation.includes('BUY') ? 'buy-signal' : 'wait-signal'}`;
    } catch (error) {
        console.error(`Error updating ${coin} data:`, error);
    } finally {
        loading.classList.add('d-none');
    }
}

async function updateHistory(coin) {
    const history = await backend.getRecommendationHistory(coin);
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';

    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <strong>${new Date(Number(item.timestamp)).toLocaleString()}</strong><br>
            Price: $${item.price.toFixed(2)} 
            <span class="${item.priceChange >= 0 ? 'price-up' : 'price-down'}">
                (${item.priceChange.toFixed(2)}%)
            </span><br>
            Recommendation: <span class="${item.recommendation.includes('BUY') ? 'buy-signal' : 'wait-signal'}">
                ${item.recommendation}
            </span>
        `;
        historyList.appendChild(div);
    });
}

async function updateChart(coin) {
    const coinId = coin === 'ICP' ? 'internet-computer' : 'bitcoin';
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30&interval=daily`);
    const data = await response.json();
    
    const prices = data.prices.map(price => ({
        x: new Date(price[0]),
        y: price[1]
    }));

    if (priceChart) {
        priceChart.destroy();
    }

    const ctx = document.getElementById('priceChart').getContext('2d');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: `${coin} Price (USD)`,
                data: prices,
                borderColor: coin === 'ICP' ? 'rgb(75, 192, 192)' : 'rgb(247, 147, 26)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                }
            }
        }
    });
}

// Event Listeners
document.getElementById('chartBtnICP').addEventListener('click', function() {
    currentCoin = 'ICP';
    updateChart('ICP');
    this.classList.add('active');
    document.getElementById('chartBtnBTC').classList.remove('active');
});

document.getElementById('chartBtnBTC').addEventListener('click', function() {
    currentCoin = 'BTC';
    updateChart('BTC');
    this.classList.add('active');
    document.getElementById('chartBtnICP').classList.remove('active');
});

document.getElementById('historyBtnICP').addEventListener('click', function() {
    updateHistory('ICP');
    this.classList.add('active');
    document.getElementById('historyBtnBTC').classList.remove('active');
});

document.getElementById('historyBtnBTC').addEventListener('click', function() {
    updateHistory('BTC');
    this.classList.add('active');
    document.getElementById('historyBtnICP').classList.remove('active');
});

// Update every 5 minutes
updateUI();
setInterval(updateUI, 5 * 60 * 1000);
