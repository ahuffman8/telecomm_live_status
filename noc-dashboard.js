// Global variables
let nodesData = [];
let performanceData = [];
let currentTimestamp = new Date();
let refreshInterval = 180; // 3 minutes
let countdownTimer = refreshInterval;
let refreshIntervalId;
let temperatureThresholds = {
    warning: 40,  // °C
    critical: 50   // °C
};
let cpuThresholds = {
    warning: 70,  // %
    critical: 90   // %
};
let simulatedDataIndex = 0;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Load data files
    Promise.all([
        loadCSV('network_nodes_metadata.csv'),
        loadCSV('network_performance_data.csv')
    ]).then(([nodes, performance]) => {
        nodesData = nodes;
        performanceData = performance;
        
        // Convert timestamp strings to Date objects
        performanceData.forEach(row => {
            row.timestamp = new Date(row.timestamp);
        });
        
        // Set up filters
        initializeFilters();
        
        // Initial update
        updateDashboard();
        
        // Set up auto-refresh
        startRefreshTimer();
        
        // Set up event listeners
        document.getElementById('apply-filters').addEventListener('click', updateDashboard);
        document.getElementById('manual-refresh').addEventListener('click', manualRefresh);
        document.getElementById('temp-view-selector').addEventListener('change', updateTemperatureChart);
        document.getElementById('utilization-metric').addEventListener('change', updateUtilizationChart);
    }).catch(error => {
        console.error('Error loading data:', error);
        alert('Failed to load data files. Please check that CSV files are in the same directory.');
    });
    
    // Update current time display
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
});

// Load CSV using PapaParse
function loadCSV(filename) {
    return new Promise((resolve, reject) => {
        Papa.parse(filename, {
            download: true,
            header: true,
            dynamicTyping: true,
            complete: results => {
                resolve(results.data.filter(row => row.node_id)); // Filter out any empty rows
            },
            error: error => {
                reject(error);
            }
        });
    });
}

// Initialize filter options
function initializeFilters() {
    // Get unique regions
    const regions = [...new Set(nodesData.map(node => node.region))];
    const regionFilter = document.getElementById('region-filter');
    regions.forEach(region => {
        if (!region) return; // Skip undefined/empty
        const option = document.createElement('option');
        option.value = region;
        option.text = region;
        regionFilter.appendChild(option);
    });
    
    // Get unique node types
    const nodeTypes = [...new Set(nodesData.map(node => node.node_type))];
    const nodeTypeFilter = document.getElementById('nodetype-filter');
    nodeTypes.forEach(type => {
        if (!type) return; // Skip undefined/empty
        const option = document.createElement('option');
        option.value = type;
        option.text = type;
        nodeTypeFilter.appendChild(option);
    });
}

// Start refresh timer
function startRefreshTimer() {
    countdownTimer = refreshInterval;
    updateCountdown();
    
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
    }
    
    refreshIntervalId = setInterval(() => {
        countdownTimer--;
        updateCountdown();
        
        if (countdownTimer <= 0) {
            updateDashboard();
            countdownTimer = refreshInterval;
        }
    }, 1000);
}

// Update countdown display
function updateCountdown() {
    const minutes = Math.floor(countdownTimer / 60);
    const seconds = countdownTimer % 60;
    document.getElementById('refresh-countdown').textContent = 
        `Auto-refresh in ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Manual refresh handler
function manualRefresh() {
    updateDashboard();
    countdownTimer = refreshInterval;
}

// Update current time
function updateCurrentTime() {
    const now = new Date();
    document.getElementById('current-time').textContent = 
        now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
}

// Get current filtered data
function getFilteredData() {
    // Get filter values
    const selectedRegion = document.getElementById('region-filter').value;
    const selectedNodeType = document.getElementById('nodetype-filter').value;
    const selectedStatus = document.getElementById('status-filter').value;
    
    // Filter nodes
    let filteredNodes = [...nodesData];
    if (selectedRegion !== 'all') {
        filteredNodes = filteredNodes.filter(node => node.region === selectedRegion);
    }
    if (selectedNodeType !== 'all') {
        filteredNodes = filteredNodes.filter(node => node.node_type === selectedNodeType);
    }
    
    // Simulate "current" performance data
    const currentPerformance = generateCurrentPerformanceData();
    
    // Add status to each node
    filteredNodes = filteredNodes.map(node => {
        const nodePerf = currentPerformance.find(p => p.node_id === node.node_id);
        const status = getNodeStatus(node, nodePerf);
        return {...node, status, performance: nodePerf};
    });
    
    // Apply status filter if selected
    if (selectedStatus !== 'all') {
        filteredNodes = filteredNodes.filter(node => node.status === selectedStatus);
    }
    
    return {nodes: filteredNodes, performance: currentPerformance};
}

// Get node status based on performance metrics
function getNodeStatus(node, perf) {
    if (!perf) return 'unknown';
    
    // Check for critical conditions
    if (perf.temperature_celsius > temperatureThresholds.critical ||
        perf.cpu_utilization_percent > cpuThresholds.critical ||
        perf.availability_percent < 95) {
        return 'critical';
    }
    
    // Check for warning conditions
    if (perf.temperature_celsius > temperatureThresholds.warning ||
        perf.cpu_utilization_percent > cpuThresholds.warning ||
        perf.availability_percent < 98) {
        return 'warning';
    }
    
    return 'healthy';
}

// Generate current performance data by simulating "live" updates
function generateCurrentPerformanceData() {
    // Get a slice of historical data as a base
    const baseIndex = simulatedDataIndex % (performanceData.length / 3);
    simulatedDataIndex += 50; // Move forward in the dataset for next refresh
    
    const baseData = performanceData.slice(baseIndex, baseIndex + 50);
    const uniqueNodeIds = [...new Set(baseData.map(row => row.node_id))];
    
    // Generate current data for each node
    const currentData = [];
    
    uniqueNodeIds.forEach(nodeId => {
        // Find a sample row for this node
        const sampleRow = baseData.find(row => row.node_id === nodeId);
        if (!sampleRow) return;
        
        // Create a copy with current timestamp
        const newRow = {...sampleRow, timestamp: new Date()};
        
        // Apply random variations
        newRow.temperature_celsius = addVariation(newRow.temperature_celsius, 5);
        newRow.cpu_utilization_percent = addVariation(newRow.cpu_utilization_percent, 10);
        newRow.memory_utilization_percent = addVariation(newRow.memory_utilization_percent, 5);
        newRow.download_bandwidth_mbps = addVariation(newRow.download_bandwidth_mbps, newRow.download_bandwidth_mbps * 0.1);
        newRow.upload_bandwidth_mbps = addVariation(newRow.upload_bandwidth_mbps, newRow.upload_bandwidth_mbps * 0.1);
        
        // Introduce occasional issues for interesting data
        if (Math.random() < 0.05) { // 5% chance of an issue
            // Randomly choose which metric to deteriorate
            const issue = Math.floor(Math.random() * 3);
            switch (issue) {
                case 0:
                    // Temperature spike
                    newRow.temperature_celsius += Math.random() * 20;
                    break;
                case 1:
                    // CPU spike
                    newRow.cpu_utilization_percent += Math.random() * 30;
                    newRow.cpu_utilization_percent = Math.min(newRow.cpu_utilization_percent, 100);
                    break;
                case 2:
                    // Network issue
                    newRow.availability_percent -= Math.random() * 5;
                    break;
            }
        }
        
        currentData.push(newRow);
    });
    
    return currentData;
}

// Add random variation to a value
function addVariation(value, maxVariation) {
    const variation = (Math.random() * 2 - 1) * maxVariation;
    return value + variation;
}

// Update the entire dashboard
function updateDashboard() {
    const {nodes, performance} = getFilteredData();
    
    updateNetworkStatus(nodes);
    updateNetworkMap(nodes);
    updateKeyMetrics(nodes);
    updateTemperatureChart(nodes);
    updateUtilizationChart(nodes);
    updateMaintenanceAlerts(nodes);
}

// Update network status counters and progress bars
function updateNetworkStatus(nodes) {
    const healthyCounts = nodes.filter(node => node.status === 'healthy').length;
    const warningCounts = nodes.filter(node => node.status === 'warning').length;
    const criticalCounts = nodes.filter(node => node.status === 'critical').length;
    const total = nodes.length;
    
    // Update count badges
    document.getElementById('healthy-count').textContent = healthyCounts;
    document.getElementById('warning-count').textContent = warningCounts;
    document.getElementById('critical-count').textContent = criticalCounts;
    
    // Update progress bar
    const healthyPercent = (healthyCounts / total) * 100;
    const warningPercent = (warningCounts / total) * 100;
    const criticalPercent = (criticalCounts / total) * 100;
    
    document.getElementById('health-progress-good').style.width = healthyPercent + '%';
    document.getElementById('health-progress-warning').style.width = warningPercent + '%';
    document.getElementById('health-progress-critical').style.width = criticalPercent + '%';
    
    // Update alert count in key metrics
    const totalAlerts = warningCounts + criticalCounts;
    document.getElementById('alert-count').textContent = totalAlerts;
    
    // Update alert badges
    const alertsElement = document.getElementById('alert-count').parentElement;
    alertsElement.querySelector('.d-flex').innerHTML = 
        `<span class="badge bg-danger me-1">${criticalCounts} Critical</span>
         <span class="badge bg-warning text-dark">${warningCounts} Warning</span>`;
}

// Update network map
function updateNetworkMap(nodes) {
    const mapData = {
        type: 'scattergeo',
        mode: 'markers',
        lon: nodes.map(node => node.longitude),
        lat: nodes.map(node => node.latitude),
        text: nodes.map(node => `${node.node_name}<br>Type: ${node.node_type}<br>Region: ${node.region}`),
        marker: {
            size: 12,
            color: nodes.map(node => {
                switch (node.status) {
                    case 'critical': return 'red';
                    case 'warning': return 'orange';
                    case 'healthy': return 'green';
                    default: return 'gray';
                }
            }),
            line: {
                width: 1
            }
        }
    };
    
    const layout = {
        geo: {
            scope: 'usa',
            projection: {
                type: 'albers usa'
            },
            showland: true,
            landcolor: 'rgb(217, 217, 217)',
            countrycolor: 'rgb(255, 255, 255)',
            subunitwidth: 1,
            countrywidth: 1,
            subunitcolor: 'rgb(255,255,255)'
        },
        margin: {
            l: 0, r: 0, t: 0, b: 0
        },
        autosize: true
    };
    
    Plotly.newPlot('network-map', [mapData], layout);
}

// Update key metrics cards
function updateKeyMetrics(nodes) {
    if (nodes.length === 0) return;
    
    // Calculate average temperature
    const avgTemp = nodes.reduce((sum, node) => 
        sum + (node.performance ? node.performance.temperature_celsius : 0), 0) / nodes.length;
    document.getElementById('avg-temp').textContent = avgTemp.toFixed(1) + '°C';
    
    // Calculate average CPU utilization
    const avgCpu = nodes.reduce((sum, node) => 
        sum + (node.performance ? node.performance.cpu_utilization_percent : 0), 0) / nodes.length;
    document.getElementById('avg-cpu').textContent = avgCpu.toFixed(1) + '%';
    
    // Calculate average availability
    const avgAvail = nodes.reduce((sum, node) => 
        sum + (node.performance ? node.performance.availability_percent : 0), 0) / nodes.length;
    document.getElementById('availability').textContent = avgAvail.toFixed(2) + '%';
    
    // Update trend charts
    updateTrendChart('temp-trend-chart', getRandomTrendData(avgTemp, 5));
    updateTrendChart('cpu-trend-chart', getRandomTrendData(avgCpu, 10));
    updateTrendChart('availability-trend-chart', getRandomTrendData(avgAvail, 1));
}

// Generate random trend data for small charts
function getRandomTrendData(currentValue, maxVariation) {
    const data = [];
    let value = currentValue;
    
    // Generate past values (with smaller variations)
    for (let i = 0; i < 10; i++) {
        value = value + (Math.random() * 2 - 1) * (maxVariation / 2);
        data.unshift(value);
    }
    
    // Add current value
    data.push(currentValue);
    
    return data;
}

// Update small trend charts
function updateTrendChart(elementId, data) {
    const trace = {
        y: data,
        mode: 'lines',
        line: {
            color: '#0d6efd',
            width: 2
        }
    };
    
    const layout = {
        margin: { t: 0, r: 0, l: 0, b: 0 },
        xaxis: { visible: false },
        yaxis: { visible: false },
        showlegend: false,
        plot_bgcolor: "rgba(0,0,0,0)",
        paper_bgcolor: "rgba(0,0,0,0)"
    };
    
    Plotly.newPlot(elementId, [trace], layout);
}

// Update temperature chart
function updateTemperatureChart() {
    const {nodes} = getFilteredData();
    const tempViewType = document.getElementById('temp-view-selector').value;
    
    let filteredNodes = nodes;
    if (tempViewType === 'warning') {
        filteredNodes = nodes.filter(node => 
            node.performance && node.performance.temperature_celsius > temperatureThresholds.warning);
    } else if (tempViewType === 'critical') {
        filteredNodes = nodes.filter(node => 
            node.performance && node.performance.temperature_celsius > temperatureThresholds.critical);
    }
    
    // Sort by temperature, highest first
    filteredNodes.sort((a, b) => {
        const tempA = a.performance ? a.performance.temperature_celsius : 0;
        const tempB = b.performance ? b.performance.temperature_celsius : 0;
        return tempB - tempA;
    });
    
    // Take top 20 nodes for readability
    filteredNodes = filteredNodes.slice(0, 20);
    
    const trace = {
        x: filteredNodes.map(node => node.node_name),
        y: filteredNodes.map(node => node.performance ? node.performance.temperature_celsius : 0),
        type: 'bar',
        marker: {
            color: filteredNodes.map(node => {
                const temp = node.performance ? node.performance.temperature_celsius : 0;
                if (temp > temperatureThresholds.critical) return '#dc3545';
                if (temp > temperatureThresholds.warning) return '#ffc107';
                return '#28a745';
            })
        }
    };
    
    const layout = {
        title: 'Node Temperature (°C)',
        xaxis: {
            title: '',
            tickangle: -45
        },
        yaxis: {
            title: 'Temperature (°C)'
        },
        shapes: [
            {
                type: 'line',
                x0: -0.5,
                x1: filteredNodes.length - 0.5,
                y0: temperatureThresholds.warning,
                y1: temperatureThresholds.warning,
                line: {
                    color: '#ffc107',
                    width: 2,
                    dash: 'dash'
                }
            },
            {
                type: 'line',
                x0: -0.5,
                x1: filteredNodes.length - 0.5,
                y0: temperatureThresholds.critical,
                y1: temperatureThresholds.critical,
                line: {
                    color: '#dc3545',
                    width: 2,
                    dash: 'dash'
                }
            }
        ],
        annotations: [
            {
                x: filteredNodes.length - 0.5,
                y: temperatureThresholds.warning,
                xref: 'x',
                yref: 'y',
                text: 'Warning',
                showarrow: false,
                bgcolor: '#ffc107',
                font: { color: 'black' },
                x: filteredNodes.length - 1,
                xanchor: 'right',
                yanchor: 'bottom'
            },
            {
                y: temperatureThresholds.critical,
                xref: 'x',
                yref: 'y',
                text: 'Critical',
                showarrow: false,
                bgcolor: '#dc3545',
                font: { color: 'white' },
                x: filteredNodes.length - 1,
                xanchor: 'right',
                yanchor: 'bottom'
            }
        ]
    };
    
    Plotly.newPlot('temperature-chart', [trace], layout);
}

// Update utilization chart
function updateUtilizationChart() {
    const {nodes} = getFilteredData();
    const metricType = document.getElementById('utilization-metric').value;
    
    let metricField, title, thresholds;
    
    switch (metricType) {
        case 'memory':
            metricField = 'memory_utilization_percent';
            title = 'Memory Utilization (%)';
            thresholds = { warning: 80, critical: 90 };
            break;
        case 'network':
            metricField = 'throughput_utilization_percent';
            title = 'Network Utilization (%)';
            thresholds = { warning: 75, critical: 90 };
            break;
        case 'cpu':
        default:
            metricField = 'cpu_utilization_percent';
            title = 'CPU Utilization (%)';
            thresholds = cpuThresholds;
            break;
    }
    
    // Sort by utilization, highest first
    nodes.sort((a, b) => {
        const valueA = a.performance ? a.performance[metricField] || 0 : 0;
        const valueB = b.performance ? b.performance[metricField] || 0 : 0;
        return valueB - valueA;
    });
    
    // Take top 20 nodes for readability
    const topNodes = nodes.slice(0, 20);
    
    const trace = {
        x: topNodes.map(node => node.node_name),
        y: topNodes.map(node => node.performance ? node.performance[metricField] || 0 : 0),
        type: 'bar',
        marker: {
            color: topNodes.map(node => {
                const value = node.performance ? node.performance[metricField] || 0 : 0;
                if (value > thresholds.critical) return '#dc3545';
                if (value > thresholds.warning) return '#ffc107';
                return '#28a745';
            })
        }
    };
    
    const layout = {
        title: title,
        xaxis: {
            title: '',
            tickangle: -45
        },
        yaxis: {
            title: '%',
            range: [0, 100]
        },
        shapes: [
            {
                type: 'line',
                x0: -0.5,
                x1: topNodes.length - 0.5,
                y0: thresholds.warning,
                y1: thresholds.warning,
                line: {
                    color: '#ffc107',
                    width: 2,
                    dash: 'dash'
                }
            },
            {
                type: 'line',
                x0: -0.5,
                x1: topNodes.length - 0.5,
                y0: thresholds.critical,
                y1: thresholds.critical,
                line: {
                    color: '#dc3545',
                    width: 2,
                    dash: 'dash'
                }
            }
        ],
        annotations: [
            {
                y: thresholds.warning,
                xref: 'x',
                yref: 'y',
                text: 'Warning',
                showarrow: false,
                bgcolor: '#ffc107',
                font: { color: 'black' },
                x: topNodes.length - 1,
                xanchor: 'right',
                yanchor: 'bottom'
            },
            {
                y: thresholds.critical,
                xref: 'x',
                yref: 'y',
                text: 'Critical',
                showarrow: false,
                bgcolor: '#dc3545',
                font: { color: 'white' },
                x: topNodes.length - 1,
                xanchor: 'right',
                yanchor: 'bottom'
            }
        ]
    };
    
    Plotly.newPlot('utilization-chart', [trace], layout);
}

// Update maintenance alerts and recommendations
function updateMaintenanceAlerts(nodes) {
    // Critical issues
    const criticalNodes = nodes.filter(node => node.status === 'critical');
    const criticalList = document.getElementById('critical-issues');
    criticalList.innerHTML = '';
    
    if (criticalNodes.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = 'No critical issues detected';
        criticalList.appendChild(li);
    } else {
        criticalNodes.forEach(node => {
            const li = document.createElement('li');
            li.className = 'list-group-item maintenance-critical';
            
            // Determine critical issue type
            let issueText = '';
            if (node.performance) {
                if (node.performance.temperature_celsius > temperatureThresholds.critical) {
                    issueText = `Temperature critical: ${node.performance.temperature_celsius.toFixed(1)}°C`;
                } else if (node.performance.cpu_utilization_percent > cpuThresholds.critical) {
                    issueText = `CPU overload: ${node.performance.cpu_utilization_percent.toFixed(1)}%`;
                } else if (node.performance.availability_percent < 95) {
                    issueText = `Low availability: ${node.performance.availability_percent.toFixed(2)}%`;
                } else {
                    issueText = 'Multiple issues detected';
                }
            }
            
            li.innerHTML = `
                <strong>${node.node_name}</strong> (${node.node_type})<br>
                <span class="badge bg-danger">Critical</span> ${issueText}<br>
                <small class="text-muted">Recommended action: Immediate maintenance required</small>
            `;
            criticalList.appendChild(li);
        });
    }
    
    // Warning alerts
    const warningNodes = nodes.filter(node => node.status === 'warning');
    const warningList = document.getElementById('warning-alerts');
    warningList.innerHTML = '';
    
    if (warningNodes.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = 'No warnings detected';
        warningList.appendChild(li);
    } else {
        // Display up to 5 warnings
        warningNodes.slice(0, 5).forEach(node => {
            const li = document.createElement('li');
            li.className = 'list-group-item maintenance-warning';
            
            // Determine warning type
            let warningText = '';
            if (node.performance) {
                if (node.performance.temperature_celsius > temperatureThresholds.warning) {
                    warningText = `High temperature: ${node.performance.temperature_celsius.toFixed(1)}°C`;
                } else if (node.performance.cpu_utilization_percent > cpuThresholds.warning) {
                    warningText = `High CPU: ${node.performance.cpu_utilization_percent.toFixed(1)}%`;
                } else {
                    warningText = 'Performance degradation';
                }
            }
            
            li.innerHTML = `
                <strong>${node.node_name}</strong><br>
                <span class="badge bg-warning text-dark">Warning</span> ${warningText}<br>
                <small class="text-muted">Monitor closely</small>
            `;
            warningList.appendChild(li);
        });
        
        // If there are more warnings than we displayed
        if (warningNodes.length > 5) {
            const li = document.createElement('li');
            li.className = 'list-group-item text-center';
            li.textContent = `+${warningNodes.length - 5} more warnings`;
            warningList.appendChild(li);
        }
    }
    
    // Generate maintenance schedule
    generateMaintenanceSchedule(nodes);
}

// Generate a synthetic maintenance schedule based on node status
function generateMaintenanceSchedule(nodes) {
    const scheduleList = document.getElementById('maintenance-schedule');
    scheduleList.innerHTML = '';
    
    // Scheduled maintenance for critical nodes
    const criticalNodes = nodes.filter(node => node.status === 'critical');
    const warningNodes = nodes.filter(node => node.status === 'warning');
    
    // If no maintenance needed
    if (criticalNodes.length === 0 && warningNodes.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = 'No maintenance currently scheduled';
        scheduleList.appendChild(li);
        return;
    }
    
    // Add critical maintenance items (within 24 hours)
    criticalNodes.slice(0, 3).forEach(node => {
        const li = document.createElement('li');
        li.className = 'list-group-item maintenance-item maintenance-critical';
        
        // Generate maintenance time within next 24 hours
        const hours = Math.floor(Math.random() * 24);
        const maintenanceTime = new Date(Date.now() + hours * 3600000);
        const timeString = maintenanceTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const dateString = maintenanceTime.toLocaleDateString([], {month: 'short', day: 'numeric'});
        
        li.innerHTML = `
            <div class="d-flex justify-content-between">
                <span><strong>${node.node_name}</strong></span>
                <span class="badge bg-danger">Urgent</span>
            </div>
            <div>${timeString} ${dateString}</div>
            <small class="text-muted">Hardware inspection required</small>
        `;
        scheduleList.appendChild(li);
    });
    
    // Add warning maintenance items (within next week)
    warningNodes.slice(0, 3).forEach(node => {
        const li = document.createElement('li');
        li.className = 'list-group-item maintenance-item maintenance-warning';
        
        // Generate maintenance time within next week
        const days = Math.floor(Math.random() * 7) + 1;
        const maintenanceTime = new Date(Date.now() + days * 86400000);
        const timeString = maintenanceTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const dateString = maintenanceTime.toLocaleDateString([], {month: 'short', day: 'numeric'});
        
        li.innerHTML = `
            <div class="d-flex justify-content-between">
                <span><strong>${node.node_name}</strong></span>
                <span class="badge bg-warning text-dark">Scheduled</span>
            </div>
            <div>${timeString} ${dateString}</div>
            <small class="text-muted">Preventative maintenance</small>
        `;
        scheduleList.appendChild(li);
    });
}
