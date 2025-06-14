/**
 * Utility for preloading lazy components to improve perceived performance
 */

// Map of component names to their import functions
const componentMap = {
  // Pages
  dashboard: () => import(/* webpackChunkName: "dashboard" */ '@/pages/Dashboard'),
  widget: () => import(/* webpackChunkName: "widget" */ '@/pages/Widget'),
  data: () => import(/* webpackChunkName: "data" */ '@/pages/Data'),
  
  // Common charts that are likely to be used
  lineChart: () => import(/* webpackChunkName: "chart-line" */ '@/widget/modules/linechart/LineChart'),
  pieChart: () => import(/* webpackChunkName: "chart-pie" */ '@/widget/modules/piechart/PieChart'),
  barChart: () => import(/* webpackChunkName: "chart-line" */ '@/widget/modules/linechart/LineChart'), // Bar uses LineChart
};

/**
 * Preload a single component
 */
export const preloadComponent = (componentName: keyof typeof componentMap) => {
  const importFn = componentMap[componentName];
  if (importFn) {
    importFn().catch(err => {
      console.warn(`Failed to preload component ${componentName}:`, err);
    });
  }
};

/**
 * Preload multiple components
 */
export const preloadComponents = (componentNames: Array<keyof typeof componentMap>) => {
  componentNames.forEach(preloadComponent);
};

/**
 * Preload components for the main dashboard view
 */
export const preloadDashboardComponents = () => {
  preloadComponents(['dashboard', 'widget', 'lineChart', 'pieChart']);
};

/**
 * Setup intersection observer to preload components when links are visible
 */
export const setupPreloadObserver = () => {
  if (!('IntersectionObserver' in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLElement;
          const route = link.getAttribute('data-preload-route');
          
          if (route) {
            switch (route) {
              case '/dashboard':
                preloadComponent('dashboard');
                break;
              case '/widget':
                preloadComponent('widget');
                break;
              case '/data':
                preloadComponent('data');
                break;
            }
            
            // Stop observing after preloading
            observer.unobserve(link);
          }
        }
      });
    },
    {
      rootMargin: '50px', // Start preloading when link is 50px away from viewport
    }
  );

  // Observe all links with data-preload-route attribute
  const links = document.querySelectorAll('[data-preload-route]');
  links.forEach(link => observer.observe(link));

  return observer;
};

/**
 * Preload components after the main bundle has loaded
 * This uses requestIdleCallback for better performance
 */
export const setupIdlePreloading = () => {
  const idlePreload = () => {
    // Preload commonly used components
    preloadComponents(['dashboard', 'widget', 'lineChart', 'pieChart']);
  };

  if ('requestIdleCallback' in window) {
    // Use requestIdleCallback if available
    (window as any).requestIdleCallback(idlePreload, { timeout: 2000 });
  } else {
    // Fallback to setTimeout
    setTimeout(idlePreload, 2000);
  }
};