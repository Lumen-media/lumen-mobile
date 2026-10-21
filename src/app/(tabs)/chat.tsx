import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useConnectionStore } from '@/src/core/connection/store';
import type { ChatMessage } from '@/src/core/protocol';
import { useChatStore } from '@/src/features/chat/chat-store';

export default function ChatScreen() {
  const { t } = useTranslation();
  const permissions = useConnectionStore((s) => s.permissions);
  const { messages, typing, sending, loadHistory, send, markRead } = useChatStore();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useFocusEffect(
    useCallback(() => {
      if (!permissions?.chat) return;
      loadHistory();
    }, [permissions?.chat, loadHistory])
  );

  useEffect(() => {
    if (!permissions?.chat) return;
    if (messages.length > 0) markRead();
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [messages.length, permissions?.chat, markRead]);

  if (!permissions?.chat) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-muted-foreground text-center text-sm">{t('chat.noPermission')}</Text>
      </View>
    );
  }

  const typingNames = Object.values(typing).join(', ');

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View className="border-edge border-b px-4 py-3">
        <Text className="text-foreground text-lg font-bold">{t('chat.title')}</Text>
      </View>

      {messages.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground text-sm">{t('chat.empty')}</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          className="flex-1"
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const isMe = item.sender_type === 'mobile';
            return (
              <View
                className={`mx-4 mb-2 max-w-[80%] rounded-xl px-3 py-2 ${
                  isMe ? 'bg-lumen-700 self-end' : 'bg-surface-raised self-start'
                }`}
              >
                {!isMe ? (
                  <Text className="text-lumen-500 text-xs font-semibold">{item.sender_name}</Text>
                ) : null}
                <Text className="text-foreground text-sm">{item.text}</Text>
                {item.ts ? (
                  <Text className="text-muted-foreground mt-1 text-[10px]">
                    {new Date(item.ts < 1e12 ? item.ts * 1000 : item.ts).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {typingNames ? (
        <Text className="text-muted-foreground px-4 pb-1 text-xs italic">
          {t('chat.typing', { names: typingNames })}
        </Text>
      ) : null}

      <View className="border-edge flex-row items-center gap-2 border-t p-3">
        <TextInput
          className="bg-surface-raised text-foreground flex-1 rounded-xl px-4 py-3 text-sm"
          placeholder={t('chat.placeholder')}
          placeholderTextColor="#71717a"
          value={text}
          onChangeText={setText}
          editable={!sending}
          returnKeyType="send"
          onSubmitEditing={() => {
            void send(text).then((ok) => {
              if (ok) setText('');
            });
          }}
        />
        <Pressable
          className="bg-lumen-600 disabled:opacity-40 rounded-xl px-4 py-3"
          disabled={sending || text.trim().length === 0}
          onPress={() => {
            void send(text).then((ok) => {
              if (ok) setText('');
            });
          }}
        >
          <Text className="text-white text-sm font-semibold">
            {sending ? t('chat.sending') : t('chat.send')}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
