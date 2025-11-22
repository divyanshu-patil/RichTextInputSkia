// Skia_RichText_MVP
// A minimal React Native + React Native Skia MVP editor.
// Files included below as single-file demo. Use this as a starting point.
// Requires: react-native, @shopify/react-native-skia

/* -----------------------------
   README / Usage
   -----------------------------
1) Install dependencies (in your RN project):
   yarn add @shopify/react-native-skia
   yarn add react-native-gesture-handler
   (follow react-native-skia installation docs for native setup)

2) Copy `App.js` into your project root (or adjust imports)
3) Run Metro and the app

This MVP demonstrates:
- Hidden native TextInput for IME/keyboard/selection
- Skia Canvas rendering of parsed tokens
- Bold / Italic / Strikethrough buttons that wrap selection in markdown
- Simple :emoji: token replacement (static emoji drawn as text)
- @mention highlight
- Basic bullets and code block toggle helpers

Notes & limitations:
- This is a minimal demo; layout & hit testing are simplified.
- Animated emoji not included (can be added via sprite atlas + animation loop).
- Selection mapping uses character indices from hidden TextInput.

Uploaded image asset available at: /mnt/data/13775a78-897e-4d65-a034-70d04c878b69.png


/* -----------------------------
   App.js
   ----------------------------- */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import {
  Canvas,
  Text as SkText,
  Group,
  Rect,
  matchFont,
} from '@shopify/react-native-skia';

// Simple tokenizer to find :emoji:, @mentions and markdown markers
function tokenizeFull(text) {
  const tokens = [];

  const re =
    /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(~~([^~]+)~~)|(:[a-z0-9_]+:)|(@[a-z0-9_]+)|(```[\s\S]*?```)|(-\s[^\n]+)/gi;

  let last = 0;
  let m;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ type: 'text', text: text.slice(last, m.index) });
    }

    if (m[1]) tokens.push({ type: 'bold', text: m[2] });
    else if (m[3]) tokens.push({ type: 'italic', text: m[4] });
    else if (m[5]) tokens.push({ type: 'strike', text: m[6] });
    else if (m[7])
      tokens.push({
        type: 'emoji',
        text: m[7],
        meta: { name: m[7].slice(1, -1) },
      });
    else if (m[8])
      tokens.push({
        type: 'mention',
        text: m[8],
        meta: { name: m[8].slice(1) },
      });
    else if (m[9]) tokens.push({ type: 'codeblock', text: m[9].slice(3, -3) });
    else if (m[10]) tokens.push({ type: 'bullet', text: m[10].slice(2) });

    last = re.lastIndex;
  }

  if (last < text.length) {
    tokens.push({ type: 'text', text: text.slice(last) });
  }

  return tokens;
}

function applyWrap(text, selection, left, right = left) {
  const { start, end } = selection;
  return (
    text.slice(0, start) +
    left +
    text.slice(start, end) +
    right +
    text.slice(end)
  );
}

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <SkiaEditor />
      </View>
    </SafeAreaView>
  );
}

function SkiaEditor() {
  const [text, setText] = useState(
    'Hello @alice, try :smile: and **bold** text\n- bullet item\n```const x = 1;```',
  );
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const inputRef = useRef(null);
  const canvasHeight = 300;

  // Create a basic font using matchFont
  const font = null;

  const onChangeText = useCallback(val => {
    setText(val);
  }, []);

  const onSelectionChange = useCallback(event => {
    setSelection({
      start: event.nativeEvent.selection.start,
      end: event.nativeEvent.selection.end,
    });
  }, []);

  const wrapSelection = useCallback(
    (left, right) => {
      const newText = applyWrap(text, selection, left, right);
      const newStart = selection.start + left.length;
      const newEnd = selection.end + left.length;
      setText(newText);

      // Update selection after state update
      setTimeout(() => {
        if (inputRef.current) {
          try {
            inputRef.current.setNativeProps({
              selection: { start: newStart, end: newEnd },
            });
          } catch (e) {
            console.warn('Selection update failed:', e);
          }
        }
      }, 50);
    },
    [text, selection],
  );

  const toggleCodeBlock = useCallback(() => {
    const newText = applyWrap(text, selection, '```\n', '\n```');
    setText(newText);

    setTimeout(() => {
      const newStart = selection.start + 4;
      const newEnd = selection.end + 4;
      if (inputRef.current) {
        try {
          inputRef.current.setNativeProps({
            selection: { start: newStart, end: newEnd },
          });
        } catch (e) {
          console.warn('Selection update failed:', e);
        }
      }
    }, 50);
  }, [text, selection]);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <ToolbarButton label="B" onPress={() => wrapSelection('**', '**')} />
        <ToolbarButton label="I" onPress={() => wrapSelection('*', '*')} />
        <ToolbarButton label="S" onPress={() => wrapSelection('~~', '~~')} />
        <ToolbarButton label="Code" onPress={toggleCodeBlock} />
      </View>

      {/* Hidden native TextInput that handles keyboard/IME/selection */}
      <View style={styles.canvasWrap} pointerEvents="box-none">
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          multiline
          value={text}
          onChangeText={onChangeText}
          onSelectionChange={onSelectionChange}
          selection={selection}
          autoCorrect={true}
          autoFocus={true}
          underlineColorAndroid="transparent"
          allowFontScaling={false}
          textAlignVertical="top"
        />

        {/* Skia Canvas rendering the tokens */}
        <Canvas
          style={{ height: canvasHeight, width: '100%' }}
          pointerEvents="none"
        >
          {text.split('\n').map((line, rowIdx) => {
            const lineY = 20 + rowIdx * 24;
            const parts = tokenizeFull(line);
            let cursorX = 8;

            return (
              <Group key={rowIdx}>
                {parts.map((p, idx) => {
                  const x = cursorX;
                  const renders = [];

                  if (p.type === 'text') {
                    renders.push(
                      <SkText
                        key={`text-${rowIdx}-${idx}`}
                        x={x}
                        y={lineY}
                        text={p.text}
                        font={font}
                        color="#000000"
                      />,
                    );
                    cursorX += p.text.length * 9;
                  } else if (p.type === 'emoji') {
                    const emoji = p.meta.name === 'smile' ? '😄' : '⬤';
                    renders.push(
                      <SkText
                        key={`emoji-${rowIdx}-${idx}`}
                        x={x}
                        y={lineY}
                        text={emoji}
                        font={font}
                        color="#000000"
                      />,
                    );
                    cursorX += 24;
                  } else if (p.type === 'mention') {
                    renders.push(
                      <Rect
                        key={`rect-${rowIdx}-${idx}`}
                        x={x - 4}
                        y={lineY - 16}
                        width={p.text.length * 9 + 8}
                        height={20}
                        color="#E3F2FD"
                        r={6}
                      />,
                    );
                    renders.push(
                      <SkText
                        key={`mention-${rowIdx}-${idx}`}
                        x={x}
                        y={lineY}
                        text={p.text}
                        font={font}
                        color="#1976D2"
                      />,
                    );
                    cursorX += p.text.length * 9 + 8;
                  } else if (p.type === 'bold') {
                    renders.push(
                      <SkText
                        key={`bold-${rowIdx}-${idx}`}
                        x={x}
                        y={lineY}
                        text={p.text}
                        font={matchFont({
                          fontSize: 16,
                          fontFamily: 'System',
                          fontWeight: 'bold',
                        })}
                        color="#000000"
                      />,
                    );
                    cursorX += p.text.length * 10;
                  } else if (p.type === 'italic') {
                    renders.push(
                      <SkText
                        key={`italic-${rowIdx}-${idx}`}
                        x={x}
                        y={lineY}
                        text={p.text}
                        font={matchFont({
                          fontSize: 16,
                          fontFamily: 'System',
                          fontStyle: 'italic',
                        })}
                        color="#000000"
                      />,
                    );
                    cursorX += p.text.length * 9;
                  } else if (p.type === 'strike') {
                    renders.push(
                      <SkText
                        key={`strike-${rowIdx}-${idx}`}
                        x={x}
                        y={lineY}
                        text={p.text}
                        font={font}
                        color="#666666"
                      />,
                    );
                    // Add strikethrough line
                    renders.push(
                      <Rect
                        key={`strike-line-${rowIdx}-${idx}`}
                        x={x}
                        y={lineY - 6}
                        width={p.text.length * 9}
                        height={1}
                        color="#666666"
                      />,
                    );
                    cursorX += p.text.length * 9;
                  } else if (p.type === 'code') {
                    const width = Math.max(80, p.text.length * 8);
                    renders.push(
                      <Rect
                        key={`code-bg-${rowIdx}-${idx}`}
                        x={x - 6}
                        y={lineY - 16}
                        width={width}
                        height={24}
                        color="#F5F5F5"
                        r={4}
                      />,
                    );
                    renders.push(
                      <SkText
                        key={`code-${rowIdx}-${idx}`}
                        x={x}
                        y={lineY}
                        text={p.text}
                        font={matchFont({
                          fontSize: 14,
                          fontFamily: 'monospace',
                        })}
                        color="#D32F2F"
                      />,
                    );
                    cursorX += p.text.length * 8 + 12;
                  } else if (p.type === 'bullet') {
                    renders.push(
                      <SkText
                        key={`bullet-${rowIdx}-${idx}`}
                        x={x - 14}
                        y={lineY}
                        text="•"
                        font={font}
                        color="#000000"
                      />,
                    );
                    cursorX += 2;
                  }

                  return renders;
                })}
              </Group>
            );
          })}
        </Canvas>
      </View>

      <View style={styles.hintRow}>
        <Text style={styles.hintText}>
          Tap editor to focus keyboard. Use toolbar to wrap selection with
          markdown.
        </Text>
      </View>
    </View>
  );
}

function ToolbarButton({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.tbBtn}>
      <Text style={styles.tbBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tbBtn: {
    padding: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    marginRight: 6,
    minWidth: 44,
    alignItems: 'center',
  },
  tbBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.3, // Set to 0.01 after testing to make it invisible
    color: '#000000',
    fontSize: 16,
    padding: 8,
    textAlignVertical: 'top',
  },
  canvasWrap: {
    height: 300,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  hintRow: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  hintText: {
    fontSize: 12,
    color: '#666666',
  },
});

/* -----------------------------
   Notes: Next steps & improvements
   -----------------------------
- Replace naive tokenizer with incremental parser to avoid re-parsing whole doc each keystroke.
- Use metrics to compute text widths accurately (measure text using Skia font metrics).
- Implement hit testing by mapping x,y -> char index using measured glyph widths.
- Add animation loop for animated emoji (use Skia's useValue & useComputedValue or requestAnimationFrame).
- Improve selection visualization: draw selection rects, custom caret.
- Persist mention metadata (id) separate from display text to enable atomic mentions.

*/
