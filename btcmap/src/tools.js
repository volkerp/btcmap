import { createSignal } from 'solid-js';
import chroma from 'chroma-js';

export const colorScale = chroma.scale(['yellow', 'blue']);
export const colorScale2 = chroma.scale('RdYlBu');
export const colorScale3 = chroma.scale('Spectral');


export const [colorSchemeName, setColorSchemeName] = createSignal('RdYlBu');
export const [colorScheme, setColorScheme] = createSignal(chroma.scale(colorSchemeName()));


export const colorBreweryColors = [
    'OrRd',
    'PuBu',
    'BuPu',
    'Oranges',
    'RdPu',
    'BuGn',
    'YlOrRd',
    'Reds',
    'PuBuGn',
    'Greens',
    'YlOrBr',
    'YlGnBu',    
    'Purples',
    'GnBu',
    'RdPu',
    'Greys',
    'YlGn',
    'Blues',
    'PuBuGn',
    'Viridis',

    'Spectral',
    'RdYlGn',
    'RdYlBu',
];

export const drawLegend = (canvas, colorScale, days) => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Get the min and max values for the selected value type
    const min = days.minValue || 0;
    const max = days.maxValue || 1;

    // Create a gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 25; i++) {
        const t = i / 25;
        const color = colorScale(t); // Replace with your color scale
        gradient.addColorStop(t, color);
    }

    // Draw the gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw the min and max labels
    ctx.fillStyle = '#000';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(min, 0, height + 10);
    ctx.textAlign = 'right';
    ctx.fillText(max, width, height + 10);
};