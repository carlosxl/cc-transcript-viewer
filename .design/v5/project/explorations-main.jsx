// Mount the design canvas with three artboards, one per direction.
// Tweaks panel exposes Variant A controls (the polished direction).

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "userRailColor": "#e8b96a",
  "harnessRailStyle": "dashed",
  "showThinking": true,
  "compact": false
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Mirror tweaks onto :root CSS vars + data attrs so the CSS rules pick them up.
  // Also expose on window so VariantA can read them at render time.
  useEffect(() => {
    window.__tweaks = t;
    const root = document.documentElement;
    root.style.setProperty('--tw-user-rail', t.userRailColor);
    root.style.setProperty('--tw-har-style', t.harnessRailStyle);
    // re-render so data-attrs on .variant-a update
    setRev((r) => r + 1);
  }, [t.userRailColor, t.harnessRailStyle, t.showThinking, t.compact]);

  const [, setRev] = useState(0);

  return (
    <>
      <DesignCanvas>
        <DCSection
          id="transcript-directions"
          title="Transcript — request / harness presentation"
          subtitle="Same Turn 4 + Turn 7 slice, three visual treatments. Click a card to focus."
        >
          <DCArtboard id="a-quiet" label="A · Quieter chrome" width={760} height={2200}>
            <VariantA />
          </DCArtboard>
          <DCArtboard id="b-lanes" label="B · Two-lane timeline" width={960} height={2400}>
            <VariantB />
          </DCArtboard>
          <DCArtboard id="c-document" label="C · Document / chat" width={760} height={2200}>
            <VariantC />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks · Variant A">
        <TweakSection label="YOU rail">
          <TweakColor
            label="Color"
            value={t.userRailColor}
            options={['#b794f6', '#7aa2f7', '#6fd29c', '#e8b96a', '#6c727f']}
            onChange={(v) => setTweak('userRailColor', v)}
          />
        </TweakSection>

        <TweakSection label="Harness rail">
          <TweakRadio
            label="Style"
            value={t.harnessRailStyle}
            options={['dashed', 'solid', 'dotted']}
            onChange={(v) => setTweak('harnessRailStyle', v)}
          />
        </TweakSection>

        <TweakSection label="Content">
          <TweakToggle
            label="Show thinking"
            value={t.showThinking}
            onChange={(v) => setTweak('showThinking', v)}
          />
          <TweakToggle
            label="Compact density"
            value={t.compact}
            onChange={(v) => setTweak('compact', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
