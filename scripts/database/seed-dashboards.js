#!/usr/bin/env node

/**
 * 📊 Dashboard Seeder - Tạo dashboard mẫu
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function seedDashboards() {
    try {
        console.log('📊 Seeding Dashboard Data...\n');

        // Get organization
        const org = await prisma.organizations.findFirst({
            where: { code: 'IOMT_HOSP' }
        });

        if (!org) {
            console.error('❌ Organization not found. Run setup script first!');
            process.exit(1);
        }

        // Sample dashboard configurations
        const dashboardData = [
            {
                name: 'Main Dashboard',
                layout: {
                    cols: 12,
                    rows: 20,
                    rowHeight: 60,
                    margin: [10, 10],
                    items: [
                        {
                            i: 'device-status',
                            x: 0, y: 0, w: 6, h: 4,
                            minW: 3, minH: 2
                        },
                        {
                            i: 'alert-summary',
                            x: 6, y: 0, w: 6, h: 4,
                            minW: 3, minH: 2
                        },
                        {
                            i: 'device-chart',
                            x: 0, y: 4, w: 12, h: 6,
                            minW: 6, minH: 4
                        },
                        {
                            i: 'recent-activities',
                            x: 0, y: 10, w: 8, h: 5,
                            minW: 4, minH: 3
                        },
                        {
                            i: 'system-stats',
                            x: 8, y: 10, w: 4, h: 5,
                            minW: 2, minH: 3
                        }
                    ]
                },
                widgets: [
                    {
                        id: 'device-status',
                        type: 'device-status-card',
                        title: 'Device Status Overview',
                        config: {
                            showTotal: true,
                            showByStatus: true,
                            refreshInterval: 30000
                        }
                    },
                    {
                        id: 'alert-summary',
                        type: 'alert-summary-card',
                        title: 'Alert Summary',
                        config: {
                            showBySeverity: true,
                            showCount: true,
                            refreshInterval: 15000
                        }
                    },
                    {
                        id: 'device-chart',
                        type: 'device-metrics-chart',
                        title: 'Device Metrics Over Time',
                        config: {
                            chartType: 'line',
                            timeRange: '24h',
                            metrics: ['voltage', 'current', 'power'],
                            refreshInterval: 60000
                        }
                    },
                    {
                        id: 'recent-activities',
                        type: 'activity-list',
                        title: 'Recent Activities',
                        config: {
                            maxItems: 10,
                            showTimestamp: true,
                            refreshInterval: 30000
                        }
                    },
                    {
                        id: 'system-stats',
                        type: 'stats-card',
                        title: 'System Statistics',
                        config: {
                            stats: ['uptime', 'totalDevices', 'activeAlerts'],
                            refreshInterval: 60000
                        }
                    }
                ]
            },
            {
                name: 'Device Monitoring',
                layout: {
                    cols: 12,
                    rows: 16,
                    rowHeight: 80,
                    margin: [15, 15],
                    items: [
                        {
                            i: 'device-grid',
                            x: 0, y: 0, w: 12, h: 8,
                            minW: 8, minH: 6
                        },
                        {
                            i: 'device-details',
                            x: 0, y: 8, w: 8, h: 6,
                            minW: 6, minH: 4
                        },
                        {
                            i: 'device-alerts',
                            x: 8, y: 8, w: 4, h: 6,
                            minW: 3, minH: 4
                        }
                    ]
                },
                widgets: [
                    {
                        id: 'device-grid',
                        type: 'device-grid-view',
                        title: 'Device Grid',
                        config: {
                            columns: ['name', 'status', 'last_update', 'alerts'],
                            sortBy: 'name',
                            pagination: true,
                            pageSize: 20
                        }
                    },
                    {
                        id: 'device-details',
                        type: 'device-detail-view',
                        title: 'Device Details',
                        config: {
                            showMetrics: true,
                            showHistory: true,
                            autoSelectFirst: true
                        }
                    },
                    {
                        id: 'device-alerts',
                        type: 'device-alert-list',
                        title: 'Device Alerts',
                        config: {
                            filterBySeverity: ['high', 'critical'],
                            maxItems: 15,
                            autoRefresh: true
                        }
                    }
                ]
            },
            {
                name: 'Analytics Dashboard',
                layout: {
                    cols: 12,
                    rows: 18,
                    rowHeight: 70,
                    margin: [12, 12],
                    items: [
                        {
                            i: 'metrics-chart-1',
                            x: 0, y: 0, w: 6, h: 6,
                            minW: 4, minH: 4
                        },
                        {
                            i: 'metrics-chart-2',
                            x: 6, y: 0, w: 6, h: 6,
                            minW: 4, minH: 4
                        },
                        {
                            i: 'usage-heatmap',
                            x: 0, y: 6, w: 8, h: 6,
                            minW: 6, minH: 4
                        },
                        {
                            i: 'top-devices',
                            x: 8, y: 6, w: 4, h: 6,
                            minW: 3, minH: 4
                        },
                        {
                            i: 'trend-analysis',
                            x: 0, y: 12, w: 12, h: 5,
                            minW: 8, minH: 4
                        }
                    ]
                },
                widgets: [
                    {
                        id: 'metrics-chart-1',
                        type: 'metrics-chart',
                        title: 'Power Consumption',
                        config: {
                            metric: 'power',
                            chartType: 'area',
                            timeRange: '7d',
                            showAverage: true
                        }
                    },
                    {
                        id: 'metrics-chart-2',
                        type: 'metrics-chart',
                        title: 'Temperature Monitoring',
                        config: {
                            metric: 'temperature',
                            chartType: 'line',
                            timeRange: '24h',
                            showThreshold: true
                        }
                    },
                    {
                        id: 'usage-heatmap',
                        type: 'usage-heatmap',
                        title: 'Device Usage Heatmap',
                        config: {
                            timeRange: '7d',
                            granularity: 'hour',
                            colorScheme: 'viridis'
                        }
                    },
                    {
                        id: 'top-devices',
                        type: 'top-list',
                        title: 'Top Active Devices',
                        config: {
                            sortBy: 'usage',
                            maxItems: 10,
                            showPercentage: true
                        }
                    },
                    {
                        id: 'trend-analysis',
                        type: 'trend-chart',
                        title: 'Usage Trend Analysis',
                        config: {
                            timeRange: '30d',
                            showPrediction: true,
                            trendType: 'polynomial'
                        }
                    }
                ]
            }
        ];

        // Create dashboards
        for (const dashboard of dashboardData) {
            try {
                const created = await prisma.dashboards.create({
                    data: {
                        id: uuidv4(),
                        name: dashboard.name,
                        organization_id: org.id,
                        layout_config: JSON.stringify(dashboard.layout),
                        widget_config: JSON.stringify(dashboard.widgets)
                    }
                });

                console.log(`✅ Created dashboard: ${dashboard.name} (${created.id})`);
                console.log(`   📐 Layout items: ${dashboard.layout.items.length}`);
                console.log(`   🎛️ Widgets: ${dashboard.widgets.length}`);
                
            } catch (error) {
                console.error(`❌ Failed to create ${dashboard.name}:`, error.message);
            }
        }

        // Summary
        const dashboardCount = await prisma.dashboards.count({
            where: { organization_id: org.id }
        });

        console.log('\n📊 Dashboard Seeding Complete!');
        console.log('=====================================');
        console.log(`✅ Total dashboards: ${dashboardCount}`);
        console.log(`🏥 Organization: ${org.name}`);
        console.log('');
        console.log('🚀 Test API Endpoints:');
        console.log('GET    /dashboards           - List all dashboards');
        console.log('GET    /dashboards/:id       - Get specific dashboard');
        console.log('POST   /dashboards           - Create new dashboard');  
        console.log('PUT    /dashboards/:id/layout - Update layout');
        console.log('PUT    /dashboards/:id/widgets - Update widgets');
        console.log('PUT    /dashboards/:id       - Update complete dashboard');
        console.log('DELETE /dashboards/:id       - Delete dashboard');

    } catch (error) {
        console.error('❌ Dashboard seeding failed:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedDashboards();
}

export default seedDashboards;