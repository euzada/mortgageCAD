document.addEventListener('DOMContentLoaded', function() {
    // Global variables to store chart instances and data
    let amortizationChart = null;
    let scenarioChart = null;
    let scenarioA = null;
    let scenarioB = null;
    let scenarioC = null;
    window.currentDetails = null; // Store details of the last calculation globally

    // Element references
    const calculateBtn = document.getElementById('calculate');
    const saveScenarioABtn = document.getElementById('save-scenario-a');
    const saveScenarioBBtn = document.getElementById('save-scenario-b');
    const saveScenarioCBtn = document.getElementById('save-scenario-c');
    const exportPdfBtn = document.getElementById('export-pdf');
    const loadingElement = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    const scheduleDiv = document.getElementById('schedule');
    const chartContainer = document.getElementById('chart-container');
    const scenarioSection = document.getElementById('scenario-section');
    const tabs = document.querySelectorAll('.tab[data-tab]');
    
    // Hide loading indicator on page load
    loadingElement.classList.add('hidden');
    
    // Setup event listeners
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            if (window.currentDetails) {
                updateChart(this.dataset.tab);
            }
        });
    });
    
    calculateBtn.addEventListener('click', calculateMortgage);
    saveScenarioABtn.addEventListener('click', () => saveScenario('A'));
    saveScenarioBBtn.addEventListener('click', () => saveScenario('B'));
    saveScenarioCBtn.addEventListener('click', () => saveScenario('C'));
    exportPdfBtn.addEventListener('click', generateProfessionalPDF);

    function calculateMortgage() {
        const principal = parseFloat(document.getElementById('principal').value);
        const interestRate = parseFloat(document.getElementById('interest').value) / 100;
        const amortizationYears = parseInt(document.getElementById('amortization').value);
        const frequency = document.getElementById('frequency').value;
        const extraPayment = parseFloat(document.getElementById('extra-payment').value) || 0;
        
        if (isNaN(principal) || isNaN(interestRate) || isNaN(amortizationYears) || principal <= 0 || interestRate <= 0 || amortizationYears <= 0) {
            alert('Please enter valid, positive numbers for all fields.');
            return;
        }
        
        const mortgageDetails = calculateMortgageDetails(principal, interestRate, amortizationYears, frequency, extraPayment);
        window.currentDetails = mortgageDetails;

        displayResults(mortgageDetails);
        generateAmortizationSchedule(mortgageDetails.yearlySchedule, mortgageDetails);
        createAmortizationChart(mortgageDetails.yearlySchedule);
        
        resultsDiv.classList.add('visible');
        scheduleDiv.classList.add('visible');
        chartContainer.classList.add('visible');
    }

    function displayResults(details) {
        document.getElementById('payment-amount').textContent = formatCurrency(details.payment);
        document.getElementById('total-payments').textContent = formatCurrency(details.totalCost);
        document.getElementById('total-interest').textContent = formatCurrency(details.totalInterest);
        document.getElementById('payoff-date').textContent = details.payoffDate;
        document.getElementById('interest-savings').textContent = formatCurrency(details.interestSavings);
        document.getElementById('total-cost').textContent = formatCurrency(details.totalCost);
        document.getElementById('ratio').textContent = details.ratio;
        document.getElementById('time-saved').textContent = details.timeSaved + ' months';
    }
    
    function calculateMortgageDetails(principal, annualRate, years, frequencyCode, extraPayment = 0) {
        const effectiveAnnualRate = Math.pow(1 + annualRate / 2, 2) - 1;
        
        const freqMap = { '12': 12, '24': 24, '26': 26, '52': 52, '13': 26 };
        const paymentsPerYear = freqMap[frequencyCode] || 12;
        const isAccelerated = (String(frequencyCode) === '13');

        let basePayment;
        const totalPaymentsOriginal = years * 12;

        if (isAccelerated) {
            const monthlyRate = Math.pow(1 + effectiveAnnualRate, 1 / 12) - 1;
            const monthlyPayment = principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -totalPaymentsOriginal));
            basePayment = monthlyPayment / 2;
        } else {
            const periodicRate = Math.pow(1 + effectiveAnnualRate, 1 / paymentsPerYear) - 1;
            const totalPayments = years * paymentsPerYear;
            basePayment = principal * periodicRate / (1 - Math.pow(1 + periodicRate, -totalPayments));
        }
        
        const totalPaymentPerPeriod = basePayment + extraPayment;
        const periodicInterestRate = Math.pow(1 + effectiveAnnualRate, 1 / paymentsPerYear) - 1;
        
        let balance = principal;
        const paymentSchedule = [];
        let totalInterestPaid = 0;
        let paymentNumber = 0;

        while (balance > 0) {
            paymentNumber++;
            let interestForPeriod = balance * periodicInterestRate;
            let principalPaid = totalPaymentPerPeriod - interestForPeriod;
            
            if (principalPaid + interestForPeriod > balance + interestForPeriod) {
                principalPaid = balance;
            }
            
            balance -= principalPaid;
            totalInterestPaid += interestForPeriod;
            
            paymentSchedule.push({
                no: paymentNumber,
                principal: principalPaid,
                interest: interestForPeriod,
                payment: principalPaid + interestForPeriod,
                balance: balance > 0 ? balance : 0
            });

            if (paymentNumber > years * paymentsPerYear * 2) { 
                console.error("Infinite loop detected in calculation.");
                break; 
            }
        }

        const yearlySchedule = [];
        if (paymentSchedule.length > 0) {
            let year = 1;
            let yearlyPrincipal = 0, yearlyInterest = 0, yearlyTotal = 0;
            paymentSchedule.forEach((p, index) => {
                yearlyPrincipal += p.principal;
                yearlyInterest += p.interest;
                yearlyTotal += p.payment;
                if ((index + 1) % paymentsPerYear === 0 || index === paymentSchedule.length - 1) {
                    yearlySchedule.push({
                        year, principal: yearlyPrincipal, interest: yearlyInterest,
                        total: yearlyTotal, balance: p.balance
                    });
                    year++;
                    yearlyPrincipal = 0; yearlyInterest = 0; yearlyTotal = 0;
                }
            });
        }
        
        const totalMonthsToPayoff = Math.ceil(paymentNumber / paymentsPerYear * 12);
        const originalTotalMonths = years * 12;
        const timeSavedInMonths = originalTotalMonths - totalMonthsToPayoff;
        
        const monthlyRateForOriginal = Math.pow(1 + effectiveAnnualRate, 1 / 12) - 1;
        const originalMonthlyPayment = principal * monthlyRateForOriginal / (1 - Math.pow(1 + monthlyRateForOriginal, -originalTotalMonths));
        const originalTotalInterest = (originalMonthlyPayment * originalTotalMonths) - principal;
        const interestSavings = originalTotalInterest - totalInterestPaid;
        
        const payoffDate = new Date();
        payoffDate.setMonth(payoffDate.getMonth() + totalMonthsToPayoff);

        return {
            payment: basePayment, totalPayment: totalPaymentPerPeriod, totalInterest: totalInterestPaid,
            totalCost: principal + totalInterestPaid,
            payoffDate: payoffDate.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
            interestSavings: interestSavings > 0 ? interestSavings : 0,
            timeSaved: timeSavedInMonths > 0 ? timeSavedInMonths : 0,
            ratio: (totalInterestPaid / principal).toFixed(2) + ':1',
            yearlySchedule, paymentSchedule, principal, interestRate: annualRate,
            amortizationYears: years, frequency: paymentsPerYear, extraPayment
        };
    }

    function generateAmortizationSchedule(yearlySchedule, mortgageDetails) {
        const body = document.getElementById('schedule-body');
        const head = document.getElementById('schedule-head');
        const btnAll = document.getElementById('toggle-full-schedule');
        const scheduleTabs = document.querySelectorAll('#schedule .tab');

        const fmt = formatCurrency;
        let view = 'yearly';
        let fullShown = false;

        function renderYearly() {
            const limit = fullShown ? yearlySchedule.length : Math.min(5, yearlySchedule.length);
            body.innerHTML = yearlySchedule.slice(0, limit).map(y => `
                <tr><td>${y.year}</td><td>${fmt(y.principal)}</td><td>${fmt(y.interest)}</td><td>${fmt(y.total)}</td><td>${fmt(y.balance)}</td></tr>`
            ).join('');
            head.innerHTML = `<tr><th>Year</th><th>Principal Paid</th><th>Interest Paid</th><th>Total Payments</th><th>Remaining Balance</th></tr>`;
        }

        function renderPayments() {
            const paymentSchedule = mortgageDetails.paymentSchedule;
            const limit = fullShown ? paymentSchedule.length : Math.min(60, paymentSchedule.length);
            body.innerHTML = paymentSchedule.slice(0, limit).map(p => `
                <tr><td>${p.no}</td><td>${fmt(p.principal)}</td><td>${fmt(p.interest)}</td><td>${fmt(p.payment)}</td><td>${fmt(p.balance)}</td></tr>`
            ).join('');
            head.innerHTML = `<tr><th>#</th><th>Principal Paid</th><th>Interest Paid</th><th>Payment</th><th>Remaining Balance</th></tr>`;
        }

        function draw() {
            view === 'yearly' ? renderYearly() : renderPayments();
        }

        scheduleTabs.forEach(tab => tab.addEventListener('click', () => {
            scheduleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            view = tab.dataset.view;
            fullShown = false;
            btnAll.innerHTML = '<i class="fas fa-eye"></i> Show Full Schedule';
            draw();
        }));

        btnAll.addEventListener('click', () => {
            fullShown = !fullShown;
            btnAll.innerHTML = fullShown ? '<i class="fas fa-eye-slash"></i> Show Summary' : '<i class="fas fa-eye"></i> Show Full Schedule';
            draw();
        });

        draw(); // Initial draw
    }

    function createAmortizationChart(yearlySchedule) {
        if (amortizationChart) amortizationChart.destroy();
        updateChart('balance', yearlySchedule);
    }

    function updateChart(type, yearlySchedule = window.currentDetails.yearlySchedule) {
        const ctx = document.getElementById('amortization-chart').getContext('2d');
        if (amortizationChart) amortizationChart.destroy();

        const labels = yearlySchedule.map(data => `Year ${data.year}`);
        let chartConfig = {
            type: 'line',
            data: { labels, datasets: [] },
            options: {
                responsive: true,
                plugins: { title: { display: true }, tooltip: { callbacks: {} } },
                scales: { x: { title: { display: true, text: 'Years' } }, y: { title: { display: true }, beginAtZero: true } }
            }
        };

        switch (type) {
            case 'balance':
                chartConfig.options.plugins.title.text = 'Remaining Balance Over Years';
                chartConfig.options.scales.y.title.text = 'Balance (CAD)';
                chartConfig.options.plugins.tooltip.callbacks.label = context => 'Balance: ' + formatCurrency(context.raw);
                chartConfig.data.datasets.push({
                    label: 'Remaining Balance',
                    data: yearlySchedule.map(d => d.balance),
                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    fill: false, tension: 0.1
                });
                break;
            case 'payments':
                chartConfig.type = 'bar';
                chartConfig.options.plugins.title.text = 'Principal vs Interest Payments by Year';
                chartConfig.options.scales.x.stacked = true;
                chartConfig.options.scales.y.stacked = true;
                chartConfig.options.scales.y.title.text = 'Amount (CAD)';
                chartConfig.options.plugins.tooltip.callbacks.label = context => context.dataset.label + ': ' + formatCurrency(context.raw);
                chartConfig.data.datasets.push(
                    { label: 'Principal Paid', data: yearlySchedule.map(d => d.principal), backgroundColor: 'rgba(46, 204, 113, 0.7)' },
                    { label: 'Interest Paid', data: yearlySchedule.map(d => d.interest), backgroundColor: 'rgba(231, 76, 60, 0.7)' }
                );
                break;
            case 'interest':
                chartConfig.options.plugins.title.text = 'Principal vs Interest Percentage Over Time';
                chartConfig.options.scales.y.title.text = 'Percentage (%)';
                chartConfig.options.scales.y.max = 100;
                chartConfig.options.plugins.tooltip.callbacks.label = context => context.dataset.label + ': ' + context.raw.toFixed(1) + '%';
                chartConfig.data.datasets.push(
                    { label: 'Principal %', data: yearlySchedule.map(d => (d.principal / d.total) * 100), borderColor: 'rgba(46, 204, 113, 1)', fill: false },
                    { label: 'Interest %', data: yearlySchedule.map(d => (d.interest / d.total) * 100), borderColor: 'rgba(231, 76, 60, 1)', fill: false }
                );
                break;
        }
        amortizationChart = new Chart(ctx, chartConfig);
    }
    
    function saveScenario(scenario) {
        if (!window.currentDetails) {
            alert('Please calculate a mortgage first.');
            return;
        }
        const scenarioData = { ...window.currentDetails }; // Clone current details
        
        if (scenario === 'A') scenarioA = scenarioData;
        else if (scenario === 'B') scenarioB = scenarioData;
        else scenarioC = scenarioData;
        
        displayScenario(scenario, scenarioData);
        
        if ((scenarioA && scenarioB) || (scenarioA && scenarioC) || (scenarioB && scenarioC)) {
            scenarioSection.classList.add('visible');
            createScenarioComparisonChart();
        }
    }
    
    function displayScenario(scenario, data) {
        const resultsDiv = document.getElementById(`scenario-${scenario.toLowerCase()}-results`);
        resultsDiv.innerHTML = `
            <div class="result-item"><span>Mortgage Amount:</span><span>${formatCurrency(data.principal)}</span></div>
            <div class="result-item"><span>Interest Rate:</span><span>${(data.interestRate * 100).toFixed(2)}%</span></div>
            <div class="result-item"><span>Payment:</span><span>${formatCurrency(data.payment)}</span></div>
            <div class="result-item"><span>Extra Payment:</span><span>${formatCurrency(data.extraPayment)}</span></div>
            <div class="result-item"><span>Total Cost:</span><span>${formatCurrency(data.totalCost)}</span></div>
            <div class="result-item"><span>Total Interest:</span><span>${formatCurrency(data.totalInterest)}</span></div>
            <div class="result-item"><span>Time Saved:</span><span>${data.timeSaved} months</span></div>`;
    }
    
    function createScenarioComparisonChart() {
        if (scenarioChart) scenarioChart.destroy();
        const ctx = document.getElementById('scenario-chart').getContext('2d');
        
        const scenarios = [scenarioA, scenarioB, scenarioC].filter(s => s);
        const maxYears = Math.max(...scenarios.map(s => s.yearlySchedule.length));
        const labels = Array.from({ length: maxYears }, (_, i) => `Year ${i + 1}`);
        
        const datasets = scenarios.map((s, i) => {
            const label = i === 0 ? 'Scenario A' : i === 1 ? 'Scenario B' : 'Scenario C';
            const colorVar = i === 0 ? '--scenario-a' : i === 1 ? '--scenario-b' : '--scenario-c';
            const color = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim();
            
            const data = s.yearlySchedule.map(d => d.balance);
            while (data.length < maxYears) data.push(null);
            
            return {
                label: `${label} Balance`, data, borderColor: color,
                fill: false, tension: 0.1
            };
        });
        
        scenarioChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Remaining Balance Comparison' },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } }
                },
                scales: {
                    x: { title: { display: true, text: 'Years' } },
                    y: { title: { display: true, text: 'Balance (CAD)' }, beginAtZero: true }
                }
            }
        });
    }

    async function generateProfessionalPDF() {
        if (!window.currentDetails) {
            alert('Please calculate a mortgage first before generating a report.');
            return;
        }

        loadingElement.classList.remove('hidden');

        const reportContainer = document.createElement('div');
        reportContainer.style.position = 'absolute';
        reportContainer.style.left = '-9999px';
        reportContainer.style.width = '1000px';
        reportContainer.style.padding = '20px';
        reportContainer.style.background = 'white';
        document.body.appendChild(reportContainer);

        try {
            reportContainer.appendChild(document.querySelector('.container header').cloneNode(true));
            reportContainer.appendChild(document.querySelector('.results.visible').cloneNode(true));

            if (scenarioSection.classList.contains('visible')) {
                const scenarioClone = scenarioSection.cloneNode(true);
                reportContainer.appendChild(scenarioClone);
            }
            if (chartContainer.classList.contains('visible')) {
                 const chartClone = chartContainer.cloneNode(true);
                 new Chart(chartClone.querySelector('canvas'), amortizationChart.config);
                 reportContainer.appendChild(chartClone);
            }

            const scheduleTemplate = document.getElementById('schedule');
            const cloneAndPrepareSchedule = (viewType) => {
                const clone = scheduleTemplate.cloneNode(true);
                clone.querySelector('h2').innerText = `Amortization Schedule (${viewType.charAt(0).toUpperCase() + viewType.slice(1)} - Full)`;
                clone.querySelector(`[data-view="${viewType}"]`).click();
                clone.querySelector('#toggle-full-schedule').click();
                clone.querySelector('.schedule-container').style.maxHeight = 'none';
                clone.querySelector('#toggle-full-schedule').style.display = 'none';
                clone.querySelector('.tabs').style.display = 'none';
                return clone;
            };

            reportContainer.appendChild(cloneAndPrepareSchedule('yearly'));
            reportContainer.appendChild(cloneAndPrepareSchedule('payment'));

            const canvas = await html2canvas(reportContainer, { scale: 2, useCORS: true });
            
            const { jsPDF } = window.jspdf;
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();

            while (heightLeft > 0) {
                position = -heightLeft;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdf.internal.pageSize.getHeight();
            }
            
            pdf.save('Canadian-Mortgage-Report.pdf');

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('An error occurred while generating the PDF.');
        } finally {
            document.body.removeChild(reportContainer);
            loadingElement.classList.add('hidden');
        }
    }
    
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
});