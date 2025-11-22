import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  Canvas,
  Text as SkText,
  Group,
  Rect,
  Line,
  vec,
  matchFont,
  Slant,
} from '@shopify/react-native-skia';

/* ---------------------------------------------------
   TOKENIZER
---------------------------------------------------- */
function tokenizeLine(line) {
  const tokens = [];

  const bullet = line.match(/^-\s+(.*)$/);
  if (bullet) {
    tokens.push({ type: 'bullet', text: '• ' });
    line = bullet[1];
  }

  if (line.trim() === '```') {
    tokens.push({ type: 'codeblock_marker', text: '```' });
    return tokens;
  }

  const re =
    /(\*([^*]+)\*)|(_([^_]+)_)|(__([^_]+)__)|(~([^~]+)~)|(```([^`]+)```)|(:[a-z0-9_]+:)|(@[a-z0-9_]+)/gi;

  let last = 0,
    m;

  while ((m = re.exec(line)) !== null) {
    if (m.index > last)
      tokens.push({ type: 'text', text: line.slice(last, m.index) });

    if (m[1]) tokens.push({ type: 'bold', text: m[2] });
    else if (m[3]) tokens.push({ type: 'italic', text: m[4] });
    else if (m[5]) tokens.push({ type: 'underline', text: m[6] });
    else if (m[7]) tokens.push({ type: 'strike', text: m[8] });
    else if (m[9]) tokens.push({ type: 'code', text: m[10] });
    else if (m[11])
      tokens.push({
        type: 'emoji',
        text: m[11],
        meta: { name: m[11].slice(1, -1) },
      });
    else if (m[12])
      tokens.push({
        type: 'mention',
        text: m[12],
        meta: { name: m[12].slice(1) },
      });

    last = re.lastIndex;
  }

  if (last < line.length) tokens.push({ type: 'text', text: line.slice(last) });

  return tokens;
}

function processText(text) {
  const lines = text.split('\n');
  const out = [];
  let inBlock = false;

  for (const line of lines) {
    if (line.trim() === '```') {
      inBlock = !inBlock;
      out.push({
        type: 'codeblock_marker',
        tokens: [{ type: 'codeblock_marker', text: '```' }],
      });
      continue;
    }
    if (inBlock) {
      out.push({
        type: 'codeblock_content',
        tokens: [{ type: 'codeblock_content', text: line }],
      });
      continue;
    }
    out.push({ type: 'normal', tokens: tokenizeLine(line) });
  }

  return out;
}

function applyWrap(text, sel, left, right = left) {
  return (
    text.slice(0, sel.start) +
    left +
    text.slice(sel.start, sel.end) +
    right +
    text.slice(sel.end)
  );
}

/* ---------------------------------------------------
   MAIN APP
---------------------------------------------------- */
export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
      <SkiaEditor />
    </SafeAreaView>
  );
}

function SkiaEditor() {
  const [text, setText] = useState(
    'Hello @alice, try :smile: and *bold* text\n- bullet item\n```inline code```',
  );
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const input = useRef(null);
  const canvasHeight = 400;

  /* ---------------------------------------------------
     FIXED FONTS (Skia Compatible)
  ---------------------------------------------------- */
  const FONT_PRIMARY = Platform.OS === 'ios' ? 'Helvetica' : 'Roboto';

  const regular = matchFont({
    fontFamily: FONT_PRIMARY,
    fontSize: 16,
  });

  const bold = matchFont({
    fontFamily: FONT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  });

  const italic = matchFont({
    fontFamily: FONT_PRIMARY,
    fontSize: 16,
    fontStyle: 'italic',
  });

  const codeFont = matchFont({
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
  });

  /* ---------------------------------------------------
     EVENTS
  ---------------------------------------------------- */
  const wrap = (l, r) => {
    const newT = applyWrap(text, selection, l, r);
    const newSel = {
      start: selection.start + l.length,
      end: selection.end + l.length,
    };
    setText(newT);
    setTimeout(() => {
      input.current?.setNativeProps({ selection: newSel });
      setSelection(newSel);
    }, 20);
  };

  const processed = useMemo(() => processText(text), [text]);

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Btn label="B" onPress={() => wrap('*', '*')} />
        <Btn label="I" onPress={() => wrap('_', '_')} />
        <Btn label="U" onPress={() => wrap('__', '__')} />
        <Btn label="S" onPress={() => wrap('~', '~')} />
        <Btn label="```" onPress={() => wrap('```', '```')} />
      </View>

      {/* TextInput (hidden) */}
      <View style={styles.editor}>
        {/* Skia Renderer */}
        <Canvas style={styles.canvas} pointerEvents="none">
          {processed.map((line, row) => {
            const y = 28 + row * 28;
            let x = 12;

            return (
              <Group key={row}>
                {line.tokens.map((t, i) => {
                  const startX = x;
                  const parts = [];

                  /* ----- TEXT ----- */
                  if (t.type === 'text') {
                    parts.push(
                      <SkText
                        key={i}
                        x={startX}
                        y={y}
                        text={t.text}
                        font={regular}
                        color="black"
                      />,
                    );
                    x += t.text.length * 9;
                  } else if (t.type === 'bold') {
                    /* ----- BOLD ----- */
                    parts.push(
                      <SkText
                        key={i}
                        x={startX}
                        y={y}
                        text={t.text}
                        font={bold}
                        color="black"
                      />,
                    );
                    x += t.text.length * 10;
                  } else if (t.type === 'italic') {
                    /* ----- ITALIC ----- */
                    parts.push(
                      <SkText
                        key={i}
                        x={startX}
                        y={y}
                        text={t.text}
                        font={italic}
                        color="black"
                      />,
                    );
                    x += t.text.length * 9;
                  } else if (t.type === 'underline') {
                    /* ----- UNDERLINE ----- */
                    const w = t.text.length * 9;
                    parts.push(
                      <SkText
                        key={i}
                        x={startX}
                        y={y}
                        text={t.text}
                        font={regular}
                        color="black"
                      />,
                    );
                    parts.push(
                      <Line
                        key={'u' + i}
                        p1={vec(startX, y + 2)}
                        p2={vec(startX + w, y + 2)}
                        color="black"
                        strokeWidth={1}
                      />,
                    );
                    x += w;
                  } else if (t.type === 'strike') {
                    /* ----- STRIKE ----- */
                    const w = t.text.length * 9;
                    parts.push(
                      <SkText
                        key={i}
                        x={startX}
                        y={y}
                        text={t.text}
                        font={regular}
                        color="#666"
                      />,
                    );
                    parts.push(
                      <Line
                        key={'s' + i}
                        p1={vec(startX, y - 6)}
                        p2={vec(startX + w, y - 6)}
                        color="#666"
                        strokeWidth={1.5}
                      />,
                    );
                    x += w;
                  } else if (t.type === 'emoji') {
                    /* ----- EMOJI ----- */
                    const emojiMap = {
                      smile: '😄',
                      rocket: '🚀',
                      fire: '🔥',
                    };
                    const e = emojiMap[t.meta.name] || '⬤';
                    parts.push(
                      <SkText
                        key={i}
                        x={startX}
                        y={y}
                        text={e}
                        font={regular}
                      />,
                    );
                    x += 24;
                  } else if (t.type === 'mention') {
                    /* ----- MENTION ----- */
                    const w = t.text.length * 9 + 8;
                    parts.push(
                      <Rect
                        key={'m-bg-' + i}
                        x={startX - 4}
                        y={y - 18}
                        width={w}
                        height={22}
                        color="#E3F2FD"
                      />,
                    );
                    parts.push(
                      <SkText
                        key={'m-' + i}
                        x={startX}
                        y={y}
                        text={t.text}
                        font={regular}
                        color="#1976D2"
                      />,
                    );
                    x += w;
                  } else if (t.type === 'code') {
                    /* ----- INLINE CODE ----- */
                    const w = Math.max(60, t.text.length * 8 + 12);
                    parts.push(
                      <Rect
                        key={'cbg' + i}
                        x={startX - 4}
                        y={y - 18}
                        width={w}
                        height={24}
                        color="#F5F5F5"
                      />,
                    );
                    parts.push(
                      <SkText
                        key={'ct' + i}
                        x={startX}
                        y={y - 1}
                        text={t.text}
                        font={codeFont}
                        color="#D32F2F"
                      />,
                    );
                    x += w;
                  } else if (t.type === 'bullet') {
                    /* ----- BULLET ----- */
                    parts.push(
                      <SkText
                        key={'b' + i}
                        x={8}
                        y={y}
                        text="•"
                        font={regular}
                        color="black"
                      />,
                    );
                    x = 28;
                  } else if (t.type === 'codeblock_content') {
                    /* ----- CODEBLOCK CONTENT ----- */
                    parts.push(
                      <Rect
                        key={'cbg' + i}
                        x={0}
                        y={y - 18}
                        width={380}
                        height={24}
                        color="#F5F5F5"
                      />,
                    );
                    parts.push(
                      <SkText
                        key={'cbc' + i}
                        x={startX}
                        y={y}
                        text={t.text}
                        font={codeFont}
                        color="#D32F2F"
                      />,
                    );
                    x += t.text.length * 8;
                  }

                  return parts;
                })}
              </Group>
            );
          })}
        </Canvas>
        <TextInput
          ref={input}
          value={text}
          multiline
          onChangeText={setText}
          onSelectionChange={e => setSelection(e.nativeEvent.selection)}
          style={styles.hiddenInput}
        />
      </View>
    </View>
  );
}

/* ---------------------------------------------------
   UI COMPONENTS
---------------------------------------------------- */
function Btn({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress}>
      <Text style={styles.btnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------------------------------------------------
   STYLES
---------------------------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  btn: {
    padding: 10,
    backgroundColor: '#EEE',
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  btnTxt: { fontWeight: '700' },
  editor: {
    height: 400,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    overflow: 'hidden',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.1,
    color: 'transparent',
    width: '100%',
    height: '100%',
    fontSize: 16,
    padding: 12,
    zIndex: 2,
  },
  canvas: {
    backgroundColor: 'transparent',
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
