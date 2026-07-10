const args = process.argv.slice(2)
const port = Number(readOption('--port') ?? process.env.NOMETER_CDP_PORT ?? 9337)
const runNativeOcr = args.includes('--native-ocr')

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  fail('Use a valid --port value for the WebView2 debugging endpoint.')
}

const endpoint = `http://127.0.0.1:${port}`
const firstClient = await connectToNoMeter(endpoint)

const firstPass = await firstClient.evaluate(`
  (async () => {
    const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const buttonByText = (label, selector = 'button') =>
      [...document.querySelectorAll(selector)].find((button) => button.textContent?.trim() === label);
    const waitFor = async (predicate, label, timeout = 15000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const value = predicate();
        if (value) return value;
        await sleep(100);
      }
      throw new Error('Timed out waiting for ' + label);
    };

    buttonByText('OCR', '.nav-item')?.click();
    const languageSelect = await waitFor(() => document.querySelector('#ocr-language'), 'OCR language selector');
    await waitFor(
      () => document.querySelector('.option-note')?.textContent?.includes('installed OCR language'),
      'installed OCR language discovery',
    );
    const languageOptions = [...languageSelect.options].map((option) => option.value);
    const languageStatus = document.querySelector('.option-note')?.textContent?.trim() ?? '';

    [...document.querySelectorAll('.tool-button')]
      .find((button) => button.querySelector('strong')?.textContent?.trim() === 'OCR searchable PDF')
      ?.click();
    await waitFor(() => document.querySelector('[aria-label="Searchable PDF OCR mode"]'), 'searchable PDF OCR modes');
    const ocrModes = [...document.querySelectorAll('[aria-label="Searchable PDF OCR mode"] button')]
      .map((button) => button.textContent?.trim());

    const workDir = document.querySelector('#native-work-folder')?.value ?? '';
    const outputDir = document.querySelector('#native-save-folder')?.value ?? '';
    const cleanupStatus = document.querySelector('.cleanup-note')?.textContent?.trim() ?? '';

    buttonByText('Convert', '.nav-item')?.click();
    document.querySelector('.sample-button')?.click();
    await waitFor(() => document.querySelectorAll('.queue-table .file-cell').length > 0, 'sample queue');

    for (let attempt = 0; attempt < 4 && document.querySelectorAll('.export-row').length === 0; attempt += 1) {
      const runButton = await waitFor(() => document.querySelector('.run-button:not(:disabled)'), 'run button');
      runButton.click();
      await sleep(500);
    }

    await waitFor(() => document.querySelectorAll('.export-row').length > 0, 'sample export', 30000);
    const exportCount = document.querySelectorAll('.export-row').length;
    const storedHistory = JSON.parse(localStorage.getItem('nometer.conversionHistory.v1') ?? '[]');

    buttonByText('History', '.nav-item')?.click();
    let historyCount = await waitFor(
      () => document.querySelectorAll('.history-row').length,
      'History view entry',
    );

    let nativeOcr = null;
    if (${runNativeOcr ? 'true' : 'false'}) {
      buttonByText('OCR', '.nav-item')?.click();
      [...document.querySelectorAll('.tool-button')]
        .find((button) => button.querySelector('strong')?.textContent?.trim() === 'OCR image text')
        ?.click();
      document.querySelector('.topbar > button.ghost-button')?.click();

      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 420;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#111111';
      context.font = 'bold 78px Arial';
      context.fillText('NOMETER OCR LANGUAGE 2026', 80, 235);
      const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([pngBlob], 'nometer-ocr-language-smoke.png', { type: 'image/png' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector('.file-picker input[type="file"]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      await waitFor(
        () => [...document.querySelectorAll('.file-cell strong')]
          .some((node) => node.textContent?.trim() === file.name),
        'native OCR input',
      );
      const nativeRunButton = await waitFor(
        () => document.querySelector('.run-button:not(:disabled)'),
        'native OCR run button',
      );
      nativeRunButton.click();
      const nativeExport = await waitFor(
        () => [...document.querySelectorAll('.export-row')]
          .find((row) => row.querySelector('strong')?.textContent?.trim() === 'nometer-ocr-language-smoke-ocr.txt'),
        'native OCR export',
        45000,
      );
      nativeOcr = {
        name: nativeExport.querySelector('strong')?.textContent?.trim() ?? '',
        savedPath: nativeExport.querySelector('code')?.textContent?.trim() ?? '',
        language: document.querySelector('#ocr-language')?.value ?? '',
      };

      buttonByText('History', '.nav-item')?.click();
      historyCount = await waitFor(
        () => document.querySelectorAll('.history-row').length >= 2
          ? document.querySelectorAll('.history-row').length
          : 0,
        'native OCR History entry',
      );
    }

    return {
      languageOptions,
      languageStatus,
      ocrModes,
      workDir,
      outputDir,
      cleanupStatus,
      exportCount,
      storedHistoryCount: storedHistory.length,
      historyCount,
      nativeOcr,
    };
  })()
`)

assert(firstPass.languageOptions.includes('eng'), 'Tesseract English language was not offered.')
assert(firstPass.languageStatus.includes('installed OCR language'), 'Installed OCR language status was missing.')
assert(firstPass.ocrModes.includes('Keep text'), 'Keep-text OCR mode was missing.')
assert(firstPass.ocrModes.includes('Redo OCR'), 'Redo-OCR mode was missing.')
assert(isNonSystemAbsolutePath(firstPass.workDir), 'Work folder was not an absolute non-system path.')
assert(isNonSystemAbsolutePath(firstPass.outputDir), 'Save folder was not an absolute non-system path.')
assert(firstPass.exportCount > 0, 'The sample conversion did not create an export.')
assert(firstPass.storedHistoryCount > 0, 'The sample conversion was not persisted to local history.')
assert(firstPass.historyCount > 0, 'The History view did not show the completed conversion.')
if (runNativeOcr) {
  assert(firstPass.nativeOcr?.language === 'eng', 'The native OCR run did not use the selected English language.')
  assert(isNonSystemAbsolutePath(firstPass.nativeOcr?.savedPath ?? ''), 'The native OCR output was not saved off C:.')
}

await firstClient.evaluate('setTimeout(() => location.reload(), 50); true')
firstClient.close()
await new Promise((resolve) => setTimeout(resolve, 1500))

const reloadClient = await connectToNoMeter(endpoint)
const reloadPass = await reloadClient.evaluate(`
  (async () => {
    const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const started = Date.now();
    while (Date.now() - started < 15000) {
      const historyButton = [...document.querySelectorAll('.nav-item')]
        .find((button) => button.textContent?.trim() === 'History');
      if (historyButton) {
        historyButton.click();
        await sleep(100);
        const historyCount = document.querySelectorAll('.history-row').length;
        if (historyCount > 0) return { historyCount };
      }
      await sleep(100);
    }
    throw new Error('Timed out waiting for persisted History after reload');
  })()
`)
reloadClient.close()

assert(reloadPass.historyCount > 0, 'History did not survive a WebView reload.')

console.log(
  JSON.stringify(
    {
      ...firstPass,
      historyAfterReload: reloadPass.historyCount,
      endpoint,
    },
    null,
    2,
  ),
)
console.log('desktop-ui-smoke: OCR controls, D-safe folders, sample export, and persistent history passed')

async function connectToNoMeter(baseUrl) {
  let targets
  try {
    const response = await fetch(`${baseUrl}/json`)
    targets = await response.json()
  } catch (error) {
    fail(`Could not reach WebView2 debugging at ${baseUrl}: ${error?.message || error}`)
  }

  const target = targets.find((candidate) => candidate.type === 'page' && /NoMeter/i.test(candidate.title))
  if (!target?.webSocketDebuggerUrl) {
    fail(`No NoMeter page target was available at ${baseUrl}.`)
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out opening the CDP socket.')), 10_000)
    socket.addEventListener('open', () => {
      clearTimeout(timer)
      resolve()
    })
    socket.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('Could not open the CDP socket.'))
    })
  })

  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  await send('Runtime.enable')

  return {
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (result.exceptionDetails) {
        const message = result.exceptionDetails.exception?.description || result.exceptionDetails.text
        throw new Error(message)
      }
      return result.result?.value
    },
    close() {
      socket.close()
    },
  }
}

function isNonSystemAbsolutePath(value) {
  return (/^[a-z]:[\\/]/i.test(value) && !/^c:[\\/]/i.test(value)) || value.startsWith('\\\\') || value.startsWith('/')
}

function readOption(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function fail(message) {
  console.error(`desktop-ui-smoke: ${message}`)
  process.exit(1)
}
