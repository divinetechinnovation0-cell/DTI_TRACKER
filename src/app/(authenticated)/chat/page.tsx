'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, MessageCircle } from 'lucide-react'
import { formatNepaliTime, formatNepaliRelativeTime } from '@/lib/nepali-date'

type ChatMsg = {
  id: string
  sender_id: string
  message: string
  created_at: string
  sender?: { name: string }
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function ChatPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [memberName, setMemberName] = useState('')
  const [members, setMembers] = useState<Record<string, string>>({}) // id -> name
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()
      if (member) {
        setMemberId(member.id)
        setMemberName(member.name)
      }

      // Load all team members for name lookup
      const { data: allMembers } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('is_active', true)
      if (allMembers) {
        const map: Record<string, string> = {}
        for (const m of allMembers) map[m.id] = m.name
        setMembers(map)
      }

      // Load last 100 messages
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*, sender:team_members!sender_id(name)')
        .order('created_at', { ascending: true })
        .limit(100)
      if (msgs) setMessages(msgs as ChatMsg[])
      setLoading(false)
    }
    init()
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('chat-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const newMessage = payload.new as ChatMsg
        // Add sender name from members map
        newMessage.sender = { name: members[newMessage.sender_id] || 'Unknown' }
        setMessages(prev => [...prev, newMessage])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [members])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim() || !memberId || sending) return
    setSending(true)
    const { error } = await supabase.from('chat_messages').insert({
      sender_id: memberId,
      message: newMsg.trim(),
    })
    if (!error) setNewMsg('')
    setSending(false)
    inputRef.current?.focus()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="text-gray-400 text-sm">Loading chat...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 py-3 px-1 border-b border-gray-200">
        <MessageCircle className="w-5 h-5 text-blue-600" />
        <h1 className="text-lg font-bold text-gray-900">Team Chat</h1>
        <span className="text-xs text-gray-400 ml-auto">{Object.keys(members).length} members</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 px-1 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">No messages yet. Start the conversation!</div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === memberId
          const senderName = msg.sender?.name || members[msg.sender_id] || 'Unknown'
          const showName = !isMe && (i === 0 || messages[i-1]?.sender_id !== msg.sender_id)
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end gap-2 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && showName && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                    {getInitials(senderName)}
                  </div>
                )}
                {!isMe && !showName && <div className="w-7 flex-shrink-0" />}
                <div>
                  {showName && !isMe && (
                    <div className="text-xs text-gray-500 mb-0.5 ml-1">{senderName}</div>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-900 rounded-bl-md'
                  }`}>
                    {msg.message}
                  </div>
                  <div className={`text-[10px] text-gray-400 mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                    {formatNepaliTime(new Date(msg.created_at))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-gray-200 bg-white p-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
        <button
          type="submit"
          disabled={!newMsg.trim() || sending}
          className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
