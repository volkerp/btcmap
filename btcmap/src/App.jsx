import { createSignal, onMount } from 'solid-js';
import Map from './Map.jsx';
import chroma from 'chroma-js';
import { drawLegend, colorScale, colorScale2, colorScale3, colorBreweryColors, colorScheme, setColorScheme,
    colorSchemeName, setColorSchemeName } from './tools';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const App = () => {
    const [days, setDays] = createSignal({});
    const [blocks, setBlocks] = createSignal({});
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal(null);
    const [scaleType, setScaleType] = createSignal('linear');
    const [valueType, setValueType] = createSignal('numTrans');
    const [colorScheme, setColorScheme] = createSignal('RdYlBu');
    const [scale, setScale] = createSignal(1.1);

    const fetchBlocks = async () => {
        const response = await fetch(`${API_BASE_URL}/api/blocks`);
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.json();

        // maybe use web worker for this if data is large
        const nestedBlocks = {};
        data.blocks.forEach((block) => {
            const date = new Date(block.timestamp * 1000);
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            if (!nestedBlocks[year]) {
                nestedBlocks[year] = {};
            }
            if (!nestedBlocks[year][month]) {
                nestedBlocks[year][month] = {};
            }
            if (!nestedBlocks[year][month][day]) {
                nestedBlocks[year][month][day] = [];
            }
            nestedBlocks[year][month][day].push(block);
        });
        setBlocks(nestedBlocks);
    }

    const fetchDays = async () => {
            const response = await fetch(`${API_BASE_URL}/api/days`);
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const data = await response.json();
            console.log('Fetched data:', data);

            // convert data.days.data from integers YYYYMMDD to strings 'YYYY-MM-DD'
            data.days = data.days.map((entry) => {
                const dateStr = String(entry.date);
                return {
                    ...entry,
                    date: new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`)
                };
            });

            let [minBlockSize, maxBlockSize] = [Infinity, -Infinity];
            let [minTransactions, maxTransactions] = [Infinity, -Infinity];
            let [minMinted, maxMinted] = [Infinity, -Infinity];
            let [minPriceUSD, maxPriceUSD] = [Infinity, -Infinity];
            let [minValue, maxValue] = [Infinity, -Infinity];
            data.days.forEach((entry) => {
                if (entry.num_transactions < minTransactions) minTransactions = entry.num_transactions;
                if (entry.num_transactions > maxTransactions) maxTransactions = entry.num_transactions;
                if (entry.size < minBlockSize) minBlockSize = entry.size;
                if (entry.size > maxBlockSize) maxBlockSize = entry.size;
                if (entry.minted_value < minMinted) minMinted = entry.minted_value;
                if (entry.minted_value > maxMinted) maxMinted = entry.minted_value;
                if (entry.priceusd < minPriceUSD) minPriceUSD = entry.priceusd;
                if (entry.priceusd > maxPriceUSD) maxPriceUSD = entry.priceusd;
                if (entry.output_value < minValue) minValue = entry.output_value;
                if (entry.output_value > maxValue) maxValue = entry.output_value;
            });

            console.log(`Transactions - Min: ${minTransactions}, Max: ${maxTransactions}`);
            console.log(`Block Size - Min: ${minBlockSize}, Max: ${maxBlockSize}`);
            console.log(`Minted - Min: ${minMinted}, Max: ${maxMinted}`);
            console.log(`Price USD - Min: ${minPriceUSD}, Max: ${maxPriceUSD}`);

            // iterate over data.days put them into nested structure by year and month
            const nestedDays = {};
            data.days.forEach((entry) => {
                const year = entry.date.getFullYear();
                const month = entry.date.getMonth();
                if (!nestedDays[year]) {
                    nestedDays[year] = {};
                }
                if (!nestedDays[year][month]) {
                    nestedDays[year][month] = [];
                }
                nestedDays[year][month].push(entry);
            });

            // add null entries for missing days
            nestedDays[2009][0].splice(0, 0, null); // add null for 2009-01-01
            nestedDays[2009][0].splice(1, 0, null); // add null for 2009-01-02
            nestedDays[2009][0].splice(3, 0, null); // add null for 2009-01-04
            nestedDays[2009][0].splice(4, 0, null); // add null for 2009-01-05
            nestedDays[2009][0].splice(5, 0, null); // add null for 2009-01-06
            nestedDays[2009][0].splice(6, 0, null); // add null for 2009-01-07
            nestedDays[2009][0].splice(7, 0, null); // add null for 2009-01-08

            nestedDays.minTransactions = minTransactions;
            nestedDays.maxTransactions = maxTransactions;
            nestedDays.minBlockSize = minBlockSize;
            nestedDays.maxBlockSize = maxBlockSize;
            nestedDays.minMinted = minMinted;
            nestedDays.maxMinted = maxMinted;
            nestedDays.minPriceUSD = minPriceUSD;
            nestedDays.maxPriceUSD = maxPriceUSD;
            nestedDays.minValue = minValue;
            nestedDays.maxValue = maxValue;
            console.log('Nested days:', nestedDays);
            setDays(nestedDays);
    };

    onMount(async () => {
        try {
            await fetchDays();
        } catch (err) {
            console.error('Failed to fetch days', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch days');
        } finally {
            setIsLoading(false);
        }

        try {
            await fetchBlocks();
        } catch (err) {
            console.error('Failed to fetch blocks', err);
        } finally {
            console.log('Finished fetching blocks');
            // draw();
        }
    });


    return (
        <div class="flex min-h-screen">
            {/* Sidebar */}
            <aside class="w-72 shrink-0 border-r bg-white p-4 space-y-6">
                <div class="space-y-2">
                    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Value</div>
                    <div class="grid grid-cols-1 gap-2">
                        {['numTrans', 'BlockSize', 'minted', 'value'].map((type) => (
                            <label class="flex items-center gap-2 rounded border p-2 hover:bg-gray-50 cursor-pointer" key={type}>
                                <input
                                    type="radio"
                                    name="valueType"
                                    value={type}
                                    class="accent-blue-600"
                                    checked={type === valueType()}
                                    onChange={() => setValueType(type)}
                                />
                                <span class="capitalize text-sm text-gray-800">{type}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Color scale</div>
                    <div class="grid grid-cols-1 gap-2">
                        {['linear', 'log10', 'logN'].map((type) => (
                            <label class="flex items-center gap-2 rounded border p-2 hover:bg-gray-50 cursor-pointer" key={type}>
                                <input
                                    type="radio"
                                    name="scaleType"
                                    value={type}
                                    class="accent-blue-600"
                                    checked={type === scaleType()}
                                    onChange={() => setScaleType(type)}
                                />
                                <span class="capitalize text-sm text-gray-800">{type}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div class="space-y-2">
                    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Color scheme</div>
                    <select
                        class="w-full border rounded p-2 text-sm"
                        value={colorSchemeName()}
                        onChange={e => {
                            setColorSchemeName(e.target.value);
                            setColorScheme(chroma.scale(e.target.value));
                        }}
                    >
                        {colorBreweryColors.map((scheme) => (
                            <option value={scheme} key={scheme}>{scheme}</option>
                        ))}
                    </select>
                </div>
                <div class="space-y-2">
                    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Legend</div>
                    <div class="grid grid-cols-1 gap-2">
                        <canvas
                            class="w-full h-6 border border-gray-300"
                            ref={(el) => drawLegend(el, colorScale, days)}
                        ></canvas>
                        <canvas
                            class="w-full h-6 border border-gray-300"
                            ref={(el) => drawLegend(el, colorScale2, days)}
                        ></canvas>
                        <canvas
                            class="w-full h-6 border border-gray-300"
                            ref={(el) => drawLegend(el, colorScale3, days)}
                        ></canvas>
                    </div>
                </div>
                <div class="text-xs text-gray-500">Scale: <span class="font-mono">{scale().toFixed(2)}</span></div>
                <div class="text-xs text-gray-500">Scale: <span class="font-mono">{colorScheme()}</span></div>
                {isLoading() && <p class="text-gray-500">Loading days…</p>}
                {error() && <p class="text-red-500">{error()}</p>}
            </aside>

            {/* Main content */}
            <main class="flex-1 overflow-hidden h-screen">
                <Map days={days} blocks={blocks} valueType={valueType} scaleType={scaleType} scale={scale} setScale={setScale} colorScheme={colorScheme} />
            </main>
        </div>
    );
};

export default App;
