import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * 📊 Dashboard API Routes
 * Supports drag-and-drop grid layout and widgets
 */

// Apply auth middleware to all dashboard routes
router.use(authMiddleware);

// GET: List all dashboards for organization
router.get('/', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.organization_id) {
      return res.status(400).json({ error: 'User must belong to an organization' });
    }

    const dashboards = await prisma.dashboards.findMany({
      where: { 
        organization_id: user.organization_id 
      },
      select: {
        id: true,
        name: true,
        layout_config: true,
        widget_config: true,
        organizations: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Parse JSON configs for response
    const formattedDashboards = dashboards.map(dashboard => ({
      id: dashboard.id,
      name: dashboard.name,
      organization: dashboard.organizations,
      layout: dashboard.layout_config ? JSON.parse(dashboard.layout_config) : [],
      widgets: dashboard.widget_config ? JSON.parse(dashboard.widget_config) : [],
      hasLayout: !!dashboard.layout_config,
      hasWidgets: !!dashboard.widget_config
    }));

    res.json({
      success: true,
      data: formattedDashboards,
      count: formattedDashboards.length
    });
    
  } catch (error) {
    console.error('Dashboard list error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboards' });
  }
});

// GET: Load specific dashboard with full config
router.get('/:id', async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const dashboard = await prisma.dashboards.findFirst({
      where: { 
        id: id,
        organization_id: user.organization_id // Security: only org dashboards
      },
      include: {
        organizations: {
          select: {
            name: true,
            code: true,
            type: true
          }
        }
      }
    });
    
    if (!dashboard) {
      return res.status(404).json({ 
        success: false,
        error: 'Dashboard not found or access denied' 
      });
    }

    // Parse JSON configurations
    const layout = dashboard.layout_config ? JSON.parse(dashboard.layout_config) : {
      cols: 12,
      rows: 20,
      items: []
    };
    
    const widgets = dashboard.widget_config ? JSON.parse(dashboard.widget_config) : [];

    res.json({
      success: true,
      data: {
        id: dashboard.id,
        name: dashboard.name,
        organization: dashboard.organizations,
        layout: layout,
        widgets: widgets,
        metadata: {
          hasLayout: !!dashboard.layout_config,
          hasWidgets: !!dashboard.widget_config,
          widgetCount: widgets.length,
          layoutItems: layout.items?.length || 0
        }
      }
    });
    
  } catch (error) {
    console.error('Dashboard get error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load dashboard' 
    });
  }
});

// POST: Create new dashboard
router.post('/', async (req, res) => {
  try {
    const user = req.user;
    const { name, layout, widgets } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Dashboard name is required' 
      });
    }

    if (!user.organization_id) {
      return res.status(400).json({ 
        success: false,
        error: 'User must belong to an organization' 
      });
    }

    // Default layout structure
    const defaultLayout = {
      cols: 12,
      rows: 20,
      rowHeight: 60,
      items: []
    };

    const dashboard = await prisma.dashboards.create({
      data: {
        name: name.trim(),
        organization_id: user.organization_id,
        layout_config: JSON.stringify(layout || defaultLayout),
        widget_config: JSON.stringify(widgets || [])
      },
      include: {
        organizations: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Dashboard created successfully',
      data: {
        id: dashboard.id,
        name: dashboard.name,
        organization: dashboard.organizations,
        layout: layout || defaultLayout,
        widgets: widgets || []
      }
    });
    
  } catch (error) {
    console.error('Dashboard create error:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false,
        error: 'Dashboard name already exists in this organization' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create dashboard' 
    });
  }
});

// PUT: Update dashboard layout (for drag-and-drop)
router.put('/:id/layout', async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { layout } = req.body;
    
    if (!layout) {
      return res.status(400).json({ 
        success: false,
        error: 'Layout configuration is required' 
      });
    }

    // Validate layout structure
    if (!layout.items || !Array.isArray(layout.items)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid layout structure: items array required' 
      });
    }

    // Security check: verify dashboard belongs to user's org
    const existingDashboard = await prisma.dashboards.findFirst({
      where: { 
        id: id,
        organization_id: user.organization_id 
      }
    });

    if (!existingDashboard) {
      return res.status(404).json({ 
        success: false,
        error: 'Dashboard not found or access denied' 
      });
    }

    await prisma.dashboards.update({
      where: { id: id },
      data: { 
        layout_config: JSON.stringify(layout)
      }
    });
    
    res.json({
      success: true,
      message: 'Dashboard layout saved successfully',
      data: {
        id: id,
        layout: layout,
        itemCount: layout.items.length
      }
    });
    
  } catch (error) {
    console.error('Dashboard layout update error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save layout' 
    });
  }
});

// PUT: Update dashboard widgets
router.put('/:id/widgets', async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { widgets } = req.body;
    
    if (!widgets || !Array.isArray(widgets)) {
      return res.status(400).json({ 
        success: false,
        error: 'Widgets array is required' 
      });
    }

    // Validate widget structure
    for (const widget of widgets) {
      if (!widget.id || !widget.type) {
        return res.status(400).json({ 
          success: false,
          error: 'Each widget must have id and type' 
        });
      }
    }

    // Security check
    const existingDashboard = await prisma.dashboards.findFirst({
      where: { 
        id: id,
        organization_id: user.organization_id 
      }
    });

    if (!existingDashboard) {
      return res.status(404).json({ 
        success: false,
        error: 'Dashboard not found or access denied' 
      });
    }

    await prisma.dashboards.update({
      where: { id: id },
      data: { 
        widget_config: JSON.stringify(widgets)
      }
    });
    
    res.json({
      success: true,
      message: 'Dashboard widgets saved successfully',
      data: {
        id: id,
        widgets: widgets,
        widgetCount: widgets.length
      }
    });
    
  } catch (error) {
    console.error('Dashboard widgets update error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save widgets' 
    });
  }
});

// PUT: Update complete dashboard (layout + widgets + name)
router.put('/:id', async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { name, layout, widgets } = req.body;

    // Security check
    const existingDashboard = await prisma.dashboards.findFirst({
      where: { 
        id: id,
        organization_id: user.organization_id 
      }
    });

    if (!existingDashboard) {
      return res.status(404).json({ 
        success: false,
        error: 'Dashboard not found or access denied' 
      });
    }

    const updateData = {};
    
    if (name && name.trim() !== '') {
      updateData.name = name.trim();
    }
    
    if (layout) {
      updateData.layout_config = JSON.stringify(layout);
    }
    
    if (widgets) {
      updateData.widget_config = JSON.stringify(widgets);
    }

    const updatedDashboard = await prisma.dashboards.update({
      where: { id: id },
      data: updateData,
      include: {
        organizations: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      message: 'Dashboard updated successfully',
      data: {
        id: updatedDashboard.id,
        name: updatedDashboard.name,
        organization: updatedDashboard.organizations,
        layout: layout,
        widgets: widgets
      }
    });
    
  } catch (error) {
    console.error('Dashboard update error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update dashboard' 
    });
  }
});

// DELETE: Remove dashboard
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    // Security check
    const existingDashboard = await prisma.dashboards.findFirst({
      where: { 
        id: id,
        organization_id: user.organization_id 
      }
    });

    if (!existingDashboard) {
      return res.status(404).json({ 
        success: false,
        error: 'Dashboard not found or access denied' 
      });
    }

    await prisma.dashboards.delete({
      where: { id: id }
    });
    
    res.json({
      success: true,
      message: 'Dashboard deleted successfully',
      data: {
        deletedId: id,
        deletedName: existingDashboard.name
      }
    });
    
  } catch (error) {
    console.error('Dashboard delete error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete dashboard' 
    });
  }
});

export default router;