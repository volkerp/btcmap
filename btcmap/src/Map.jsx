import { onMount, onCleanup, createEffect } from 'solid-js';

// Map / Canvas component extracted from App.jsx
// Props expect Solid signals (accessor functions) for reactivity:
// days, blocks, valueType, colorScale
const Map = (props) => {
    let canvasRef;
    let ctx;

    let offsetX = 0;
    let offsetY = 0;
    let isPanning = false;
    let lastClientX = 0;
    let lastClientY = 0;
    let visible = { x: 0, y: 0, width: 0, height: 0 };

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS_IN_WEEK = 7;
    const MAX_WEEKS = 6;
    const DAY_WIDTH = 6;
    const DAY_HEIGHT = 6;
    const DAY_GAP = 2;
    const MONTH_GAP_X = 20;
    const YEAR_GAP_Y = 30;
    const LEFT_MARGIN = 80;
    const TOP_MARGIN = 50;
    const NV_COLOR = '#9b9da0';

    const lerp = (start, end, amount) => start + (end - start) * amount;
    const lerpLog2 = (start, end, amount) => {
        const logStart = Math.log2(start);
        const logEnd = Math.log2(end);
        const logValue = lerp(logStart, logEnd, amount);
        return Math.pow(2, logValue);
    };
    const lerpLog10 = (start, end, amount) => {
        const logStart = Math.log10(start);
        const logEnd = Math.log10(end);
        const logValue = lerp(logStart, logEnd, amount);
        return Math.pow(10, logValue);
    };
    const lerpLogN = (start, end, amount, base = Math.E) => {
        const logStart = Math.log(start) / Math.log(base);
        const logEnd = Math.log(end) / Math.log(base);
        const logValue = lerp(logStart, logEnd, amount);
        return Math.pow(base, logValue);
    };

    const getDayColor = (value, minValue, maxValue, type = 'linear') => {
        if (!Number.isFinite(value) || value <= 0) {
            return NV_COLOR;
        }
        const clamped = Math.min(Math.max(value, minValue), maxValue);
        const range = maxValue - minValue;
        const t = range === 0 ? 0 : (clamped - minValue) / range;

        switch (type) {
            case 'log2': {
                const logValue = lerpLog2(minValue, maxValue, t);
                const logT = (Math.log2(logValue) - Math.log2(minValue)) / (Math.log2(maxValue) - Math.log2(minValue));
                const r = Math.round(lerp(16, 239, logT));
                const g = Math.round(lerp(185, 68, logT));
                const b = Math.round(lerp(129, 68, logT));
                return `rgb(${r}, ${g}, ${b})`;
            }
            case 'log10': {
                const logMin = Math.log10(minValue);
                const logMax = Math.log10(maxValue);
                const logValue = Math.log10(clamped);
                const logT = (logValue - logMin) / (logMax - logMin);
                const r = Math.round(lerp(16, 239, logT));
                const g = Math.round(lerp(185, 68, logT));
                const b = Math.round(lerp(129, 68, logT));
                return `rgb(${r}, ${g}, ${b})`;
            }
            case 'logN': {
                const logMin = Math.log(minValue);
                const logMax = Math.log(maxValue);
                const logValue = Math.log(clamped);
                const logT = (logValue - logMin) / (logMax - logMin);
                const r = Math.round(lerp(16, 239, logT));
                const g = Math.round(lerp(185, 68, logT));
                const b = Math.round(lerp(129, 68, logT));
                return `rgb(${r}, ${g}, ${b})`;
            }
            case 'linear':
            default: {
                const r = Math.round(lerp(16, 239, t));
                const g = Math.round(lerp(185, 68, t));
                const b = Math.round(lerp(129, 68, t));
                return `rgb(${r}, ${g}, ${b})`;
            }
        }
    };

    const draw = () => {
        if (!canvasRef) return;
        ctx = ctx ?? canvasRef.getContext('2d');
        if (!ctx) return;
        const { width, height } = canvasRef;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.translate(-offsetX, -offsetY);
        ctx.scale(props.scale(), props.scale());
        visible.x = offsetX / props.scale();
        visible.y = offsetY / props.scale();
        visible.width = width / props.scale();
        visible.height = height / props.scale();

        const myDays = props.days();
        if (Object.keys(myDays).length === 0) {
            ctx.restore();
            return;
        }
        const monthWidth = DAYS_IN_WEEK * DAY_WIDTH + (DAYS_IN_WEEK - 1) * DAY_GAP;
        const monthHeight = MAX_WEEKS * DAY_HEIGHT + (MAX_WEEKS - 1) * DAY_GAP;
        ctx.fillStyle = '#94a3b8';
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';
    ctx.font = `${12 / props.scale()}px sans-serif`;
        MONTH_NAMES.forEach((name, monthIndex) => {
            const monthX = LEFT_MARGIN + monthIndex * (monthWidth + MONTH_GAP_X);
            ctx.fillText(name, monthX, TOP_MARGIN - 14);
        });
        let year = 2009;
        while (true) {
            const yearY = TOP_MARGIN + (year - 2009) * (monthHeight + YEAR_GAP_Y);
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(String(year), 10, yearY + monthHeight / 2);
            year++;
            let month = 0;
            while (month < 12) {
                if (props.scale() > 3.0) {
                    ctx.fillStyle = '#94a3b8';
                    ctx.font = `6px sans-serif`;
                    const label = `${year - 1}-${String(month + 1).padStart(2, '0')}`;
                    const labelX = LEFT_MARGIN + month * (monthWidth + MONTH_GAP_X);
                    ctx.fillText(label, labelX, yearY - 10);
                }
                drawMonth(ctx, year - 1, month,
                    LEFT_MARGIN + month * (monthWidth + MONTH_GAP_X),
                    yearY,
                    myDays);
                month++;
            }
            if (year > new Date().getFullYear()) break;
        }
        ctx.restore();
    };

    const drawMonth = (ctx, year, month, offsetXMonth, offsetYMonth, myDays) => {
        const firstDay = new Date(year, month, 1);
        const startingWeekday = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const dayData = myDays[year]?.[month]?.[day - 1];
            const weekIndex = Math.floor((day - 1 + startingWeekday) / DAYS_IN_WEEK);
            const weekdayIndex = (day - 1 + startingWeekday) % DAYS_IN_WEEK;
            const x = offsetXMonth + weekdayIndex * (DAY_WIDTH + DAY_GAP);
            const y = offsetYMonth + weekIndex * (DAY_HEIGHT + DAY_GAP);
            if (x + DAY_WIDTH < visible.x || x > visible.x + visible.width ||
                y + DAY_HEIGHT < visible.y || y > visible.y + visible.height) {
                continue;
            }
            let color = NV_COLOR;
            if (dayData) {
                switch (props.valueType()) {
                    case 'BlockSize':
                        color = getDayColor(dayData.size, myDays.minBlockSize, myDays.maxBlockSize, props.colorScale());
                        break;
                    case 'priceUSD':
                        color = getDayColor(dayData.priceusd, myDays.minPriceUSD, myDays.maxPriceUSD, props.colorScale());
                        break;
                    case 'minted':
                        color = getDayColor(dayData.minted_value, myDays.minMinted, myDays.maxMinted, props.colorScale());
                        break;
                    case 'numTrans':
                    default:
                        color = getDayColor(dayData.num_transactions, myDays.minTransactions, myDays.maxTransactions, props.colorScale());
                        break;
                }
            }
            if (props.scale() > 20.0) {
                ctx.fillStyle = '#94a3b8';
                ctx.font = `0.5px sans-serif`;
                const label = `${year - 1}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                ctx.fillText(label, x, y - 0.2);
            }
            if (props.scale() < 4) {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, DAY_WIDTH, DAY_HEIGHT);
            } else {
                drawDay(ctx, year, month, day, x, y, props.blocks());
            }
        }
    };

    const drawDay = (ctx, year, month, day, offsetXDay, offsetYDay, blocks) => {
        const dayData = blocks[year]?.[month]?.[day];
        if (!dayData) return;
        const BLOCKS_PER_ROW = 13;
        const BLOCK_SIZE = (props.scale() < 8.0) ? DAY_WIDTH / BLOCKS_PER_ROW : DAY_WIDTH / (BLOCKS_PER_ROW + 4);
        let BLOCK_GAP = 0.0;
        if (props.scale() < 8.0) {
            BLOCK_GAP = 0.0;
        } else if (props.scale() > 8.0 && props.scale() < 10.0) {
            BLOCK_GAP = BLOCK_SIZE / 5.0;
        } else {
            BLOCK_GAP = BLOCK_SIZE / 3.5;
        }
        let blockIndex = 0;
        for (let row = 0; row < BLOCKS_PER_ROW + 10; row++) {
            if (blockIndex >= dayData.length) break;
            for (let col = 0; col < BLOCKS_PER_ROW; col++) {
                const x = offsetXDay + col * (BLOCK_SIZE + BLOCK_GAP);
                const y = offsetYDay + row * (BLOCK_SIZE + BLOCK_GAP);
                let color = '#000000';
                switch (props.valueType()) {
                    case 'BlockSize':
                        color = getDayColor(dayData[blockIndex]?.size, props.days().minBlockSize, props.days().maxBlockSize, props.colorScale());
                        break;
                    case 'minted':
                        color = getDayColor(dayData[blockIndex]?.minted_value, props.days().minMinted, props.days().maxMinted, props.colorScale());
                        break;
                    case 'numTrans':
                    default:
                        color = getDayColor(dayData[blockIndex]?.num_transactions, props.days().minTransactions, props.days().maxTransactions, props.colorScale());
                        break;
                }
                ctx.fillStyle = color;
                ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
                if (++blockIndex >= dayData.length) break;
            }
        }
    };

    // Interaction handlers
    const handleMouseUp = () => { isPanning = false; };
    const handleWheel = (event) => {
        event.preventDefault();
        const mouseX = event.offsetX;
        const mouseY = event.offsetY;
        const worldX = (mouseX + offsetX) / props.scale();
        const worldY = (mouseY + offsetY) / props.scale();
        const delta = event.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.max(1.0, Math.min(props.scale() * delta, 50));
        props.setScale(newScale);
        offsetX = worldX * newScale - mouseX;
        offsetY = worldY * newScale - mouseY;
        draw();
    };
    const handleMouseDown = (event) => {
        event.preventDefault();
        isPanning = true;
        lastClientX = event.clientX;
        lastClientY = event.clientY;
    };
    const handleMouseMove = (event) => {
        if (!isPanning) return;
        const dx = event.clientX - lastClientX;
        const dy = event.clientY - lastClientY;
        offsetX -= dx;
        offsetY -= dy;
        lastClientX = event.clientX;
        lastClientY = event.clientY;
        draw();
    };
    const handleMouseLeave = () => { handleMouseUp(); };

    // Redraw on relevant prop changes
    createEffect(() => {
        props.days();
        props.blocks();
        props.valueType();
        props.colorScale();
        props.scale();
        draw();
    });

    onMount(() => {
        window.addEventListener('mouseup', handleMouseUp);
        if (canvasRef) {
            ctx = canvasRef.getContext('2d');
            // Ensure canvas fills available space
            const updateSize = () => {
                const parent = canvasRef.parentElement;
                if (!parent) return;
                const w = parent.clientWidth;
                const h = parent.clientHeight;
                if (!w || !h) return;
                let changed = false;
                if (canvasRef.width !== w) { canvasRef.width = w; changed = true; }
                if (canvasRef.height !== h) { canvasRef.height = h; changed = true; }
                if (changed) draw();
            };
            updateSize();
            let ro;
            if ('ResizeObserver' in window) {
                ro = new ResizeObserver(() => updateSize());
                ro.observe(canvasRef.parentElement);
            } else {
                window.addEventListener('resize', updateSize);
            }
            // store cleanup
            canvasRef._cleanupResize = () => {
                if (ro) ro.disconnect();
                else window.removeEventListener('resize', updateSize);
            };
            draw();
        }
    });
    onCleanup(() => {
        window.removeEventListener('mouseup', handleMouseUp);
        if (canvasRef && canvasRef._cleanupResize) {
            canvasRef._cleanupResize();
        }
    });

    return (
        <canvas
            class="w-full h-full border border-gray-300 shadow bg-zinc-900 block"
            ref={(el) => (canvasRef = el)}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        />
    );
};

export default Map;
