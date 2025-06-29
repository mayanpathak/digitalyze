'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { aiService } from '../../../../services/ai';
import { dataService } from '../../../../services/data';
import { EntityType } from '../../../../types';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    entityType?: EntityType;
    dataContext?: any;
  };
}

interface DataContext {
  clients: number;
  workers: number;
  tasks: number;
  lastUpdated: string;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [dataContext, setDataContext] = useState<DataContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get data context for better insights
  const { data: clientStats } = useQuery({
    queryKey: ['entity-stats', 'clients'],
    queryFn: () => dataService.getEntityStats('clients'),
  });

  const { data: workerStats } = useQuery({
    queryKey: ['entity-stats', 'workers'],
    queryFn: () => dataService.getEntityStats('workers'),
  });

  const { data: taskStats } = useQuery({
    queryKey: ['entity-stats', 'tasks'],
    queryFn: () => dataService.getEntityStats('tasks'),
  });

  // Update data context when stats change
  useEffect(() => {
    if (clientStats && workerStats && taskStats) {
      setDataContext({
        clients: clientStats.total || 0,
        workers: workerStats.total || 0,
        tasks: taskStats.total || 0,
        lastUpdated: new Date().toISOString()
      });
    }
  }, [clientStats, workerStats, taskStats]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize chat with welcome message
  useEffect(() => {
    if (dataContext && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        type: 'assistant',
        content: `Hello! 👋 I'm your AI data assistant. I can see you have **${dataContext.clients} clients**, **${dataContext.workers} workers**, and **${dataContext.tasks} tasks** in your system.

I'm here to help you unlock insights from your data! Here's what I can do:

📊 **Data Analysis**: Deep dive into your uploaded files and reveal hidden patterns
🔍 **Smart Insights**: Discover trends, correlations, and opportunities in your data  
💡 **Optimization**: Get actionable recommendations to improve efficiency and allocation
🎯 **Custom Queries**: Ask me anything about your data in plain English
📈 **Performance Metrics**: Analyze utilization, priorities, and resource distribution

Think of me as your personal data scientist - I'm here to make your data tell its story! What would you like to explore first?`,
        timestamp: new Date(),
        metadata: { dataContext }
      };
      setMessages([welcomeMessage]);
    }
  }, [dataContext, messages.length]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return await aiService.chat(message, dataContext);
    },
    onSuccess: (response, userMessage) => {
      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        type: 'user',
        content: userMessage,
        timestamp: new Date()
      };

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: response.response || response.explanation || response.interpretedFilter || 'I understand your question. Let me analyze your data to provide insights.',
        timestamp: new Date(),
        metadata: {
          dataContext: response.dataInsights || response
        }
      };

      setMessages((prev: ChatMessage[]) => [...prev, userMsg, assistantMsg]);
      setInputMessage('');
    },
    onError: (error: any) => {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: 'I apologize, but I encountered an issue while analyzing your data. Please try asking your question in a different way.',
        timestamp: new Date()
      };
      setMessages((prev: ChatMessage[]) => [...prev, errorMsg]);
      toast.error('Failed to get AI response');
    }
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    if (!dataContext || (dataContext.clients === 0 && dataContext.workers === 0 && dataContext.tasks === 0)) {
      toast.error('Please upload some data first before asking questions');
      return;
    }

    chatMutation.mutate(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQuestions = [
    "What insights can you provide about my data?",
    "Tell me about my current resource allocation",
    "What patterns do you see in my tasks?",
    "How can I optimize my workflow?",
    "Show me priority distributions across projects",
    "What data quality issues should I address?",
    "Give me recommendations for improvement",
    "Analyze my worker utilization rates"
  ];

  const handleSuggestedQuestion = (question: string) => {
    setInputMessage(question);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">AI Data Chat</h1>
          <p className="text-gray-600 mt-1">
            Chat with your data - ask questions and get AI-powered insights
          </p>
          {dataContext && (
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span>📊 {dataContext.clients} Clients</span>
              <span>👥 {dataContext.workers} Workers</span>
              <span>📋 {dataContext.tasks} Tasks</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg p-4 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <div className="prose prose-sm max-w-none">
                  {message.content.split('\n').map((line, index) => (
                    <p key={index} className={message.type === 'user' ? 'text-white' : ''}>
                      {line.includes('**') ? (
                        <span dangerouslySetInnerHTML={{
                          __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        }} />
                      ) : (
                        line
                      )}
                    </p>
                  ))}
                </div>
                <div className={`text-xs mt-2 ${message.type === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600">AI is analyzing your data...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Try asking:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="text-left p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-4">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your data..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={2}
                disabled={chatMutation.isPending}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || chatMutation.isPending}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
} 