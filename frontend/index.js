import { backend } from "declarations/backend";

let priceChart;

async function fetchICPPrice() {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd&include_24hr_change=true');
    const data = await response.json();
    return {
        price: data['internet-computer'].usd,
        change24h: data['internet-computer'].usd_24h_change
    };
}

async function updateUI() {
    const loading = document.getElementById('loading');
    loading.classList.remove('d-none');

    try {
        const priceData = await fetchICPPrice();
        const recommendation = await backend.getTradeRecommendation(priceData.price, priceData.change24h);
        
        document.getElementById('currentPrice').textContent = `$${priceData.price.toFixed(2)} (${priceData.change24h.toFixed(2)}%)`;
        
        const recommendationElement = document.getElementById('recommendation');
        recommendationElement.textContent = recommendation;
        recommendationElement.className = `recommendation-text ${recommendation.includes('BUY') ? 'buy-signal' : 'wait-signal'}`;

        await updateHistory();
        await updateChart();
    } catch (error) {
        console.error('Error updating UI:', error);
    } finally {
        loading.classList.add('d-none');
    }
}

async function updateHistory() {
    const history = await backend.getRecommendationHistory();
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

async function updateChart() {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/internet-computer/market_chart?vs_currency=usd&days=30&interval=daily');
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
                label: 'ICP Price (USD)',
                data: prices,
                borderColor: 'rgb(75, 192, 192)',
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

// Update every 5 minutes
updateUI();
setInterval(updateUI, 5 * 60 * 1000);
