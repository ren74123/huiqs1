import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ArrowLeft, Bell, Package, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { isValidUUID } from '../utils/validation';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  content: string;
  type: string;
  created_at: string;
  read: boolean;
  sender: {
    full_name: string;
    avatar_url: string;
    user_role: string;
  };
  order_info?: {
    id: string;
    order_number?: string;
    travel_packages?: {
      title: string;
      destination: string;
    };
  };
  enterprise_order_info?: {
    id: string;
    departure_location: string;
    destination_location: string;
  };
}

export function Messages() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'order' | 'system'>('order');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserRole();
      fetchMessages();
    }
  }, [user, activeTab]);

  async function fetchUserRole() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('id', user?.id)
        .single();
        
      if (!error && data) {
        setUserRole(data.user_role);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  }

  async function fetchMessages() {
    try {
      setLoading(true);
      // Get user's role to determine which messages to fetch
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('id', user?.id)
        .single();
        
      if (profileError) throw profileError;
      
      let query = supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(
            full_name,
            avatar_url,
            user_role
          )
        `)
        .order('created_at', { ascending: false });
        
      // For regular users and agents, show messages directed to them
      if (profile.user_role === 'user' || profile.user_role === 'agent') {
        query = query.eq('receiver_id', user?.id);
      }
      
      // For admins, show all system messages and messages they sent
      if (profile.user_role === 'admin') {
        query = query.or(`receiver_id.eq.${user?.id},type.eq.system,sender_id.eq.${user?.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Mark messages as read
      if (data?.length) {
        const unreadMessages = data.filter(msg => !msg.read && isValidUUID(msg.id)).map(msg => msg.id);
        
        if (unreadMessages.length > 0) {
          await supabase
            .from('messages')
            .update({ read: true })
            .in('id', unreadMessages);
        }
      }
      
      // Fetch order information for messages that mention orders
      const messagesWithOrderInfo = await Promise.all((data || []).map(async (msg) => {
        // Check if message is about an order
        if (msg.content.includes('订单') || msg.content.includes('套餐')) {
          // Try to extract order ID or package ID from content
          const orderMatch = msg.content.match(/订单.*?(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/);
          const packageMatch = msg.content.match(/套餐.*?(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/);
          
          if (orderMatch && orderMatch[1]) {
            const orderId = orderMatch[1];
            const { data: orderData } = await supabase
              .from('orders')
              .select(`
                id,
                order_number,
                travel_packages(
                  title,
                  destination
                )
              `)
              .eq('id', orderId)
              .single();
              
            if (orderData) {
              return {
                ...msg,
                order_info: orderData
              };
            }
          } else if (packageMatch && packageMatch[1]) {
            const packageId = packageMatch[1];
            const { data: packageData } = await supabase
              .from('travel_packages')
              .select('title, destination')
              .eq('id', packageId)
              .single();
              
            if (packageData) {
              return {
                ...msg,
                order_info: {
                  id: packageId,
                  travel_packages: packageData
                }
              };
            }
          }
        }
        
        // Check if message is about enterprise order
        if (msg.content.includes('企业团建')) {
          const enterpriseMatch = msg.content.match(/企业团建.*?(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/);
          
          if (enterpriseMatch && enterpriseMatch[1]) {
            const enterpriseId = enterpriseMatch[1];
            const { data: enterpriseData } = await supabase
              .from('enterprise_orders')
              .select('id, departure_location, destination_location')
              .eq('id', enterpriseId)
              .single();
              
            if (enterpriseData) {
              return {
                ...msg,
                enterprise_order_info: enterpriseData
              };
            }
          }
        }
        
        return msg;
      }));
      
      // For agents, also fetch order messages
      if (profile.user_role === 'agent') {
        await fetchOrderMessages(messagesWithOrderInfo);
      } else {
        setMessages(messagesWithOrderInfo);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  }

  // For agents, also fetch order messages
  async function fetchOrderMessages(existingMessages: Message[]) {
    try {
      if (!user || !isValidUUID(user.id)) {
        console.error('Invalid user ID');
        setMessages(existingMessages);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('message_logs')
        .select(`
          *,
          orders!inner(
            id,
            order_number,
            travel_packages!inner(
              title,
              destination,
              agent_id
            )
          )
        `)
        .eq('orders.travel_packages.agent_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // Mark messages as read
      if (data?.length) {
        const unreadMessages = data.filter(msg => !msg.read && isValidUUID(msg.id)).map(msg => msg.id);
        
        if (unreadMessages.length > 0) {
          await supabase
            .from('message_logs')
            .update({ read: true })
            .in('id', unreadMessages);
        }
        
        // Convert message_logs to the same format as messages
        const orderMessages = data.map(log => ({
          id: log.id,
          sender_id: log.from_role === 'user' ? log.orders.user_id : user?.id,
          receiver_id: log.from_role === 'user' ? user?.id : log.orders.user_id,
          content: log.message,
          type: 'order',
          created_at: log.created_at,
          read: log.read,
          sender: {
            full_name: log.from_role === 'user' ? '客户' : '我',
            avatar_url: '',
            user_role: log.from_role
          },
          order_info: {
            id: log.order_id,
            order_number: log.orders.order_number,
            travel_packages: {
              title: log.orders.travel_packages.title,
              destination: log.orders.travel_packages.destination
            }
          }
        }));
        
        // Merge with existing messages
        const allMessages = [...existingMessages, ...orderMessages].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        setMessages(allMessages);
      } else {
        setMessages(existingMessages);
      }
    } catch (error) {
      console.error('Error fetching order messages:', error);
      setMessages(existingMessages);
    } finally {
      setLoading(false);
    }
  }

  // Filter messages based on active tab
  const filteredMessages = messages.filter(message => {
    if (activeTab === 'all') return true;
    if (activeTab === 'order') return message.type === 'order' || message.order_info;
    if (activeTab === 'system') return message.type === 'system';
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F52E6B] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-medium">消息中心</h1>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('order')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center ${
                activeTab === 'order'
                  ? 'border-b-2 border-[#F52E6B] text-[#F52E6B]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package className="h-4 w-4 mr-2" />
              <span>订单消息</span>
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center ${
                activeTab === 'system'
                  ? 'border-b-2 border-[#F52E6B] text-[#F52E6B]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bell className="h-4 w-4 mr-2" />
              <span>系统通知</span>
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center ${
                activeTab === 'all'
                  ? 'border-b-2 border-[#F52E6B] text-[#F52E6B]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span>全部消息1</span>
            </button>
          </nav>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">暂无消息</p>
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div
                key={message.id}
                className="p-4 hover:bg-gray-50"
              >
                <div className="flex items-start space-x-4">
                  <img
                    src={message.sender?.avatar_url || 'https://via.placeholder.com/40'}
                    alt={message.sender?.full_name || 'Unknown User'}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <h3 className="text-sm font-medium text-gray-900">
                          {message.sender?.full_name || 'Unknown User'}
                        </h3>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          message.type === 'system'
                            ? 'bg-blue-100 text-blue-800'
                            : message.type === 'order'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {message.type === 'system' ? '系统' :
                           message.type === 'order' ? '订单' : 
                           message.sender?.user_role === 'admin' ? '管理员' : '用户'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 break-words whitespace-pre-wrap">
                      {message.content}
                    </p>
                    
                    {/* Order information */}
                    {message.order_info && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                        <p>订单号: {message.order_info.order_number || message.order_info.id.slice(0, 8)}</p>
                        {message.order_info.travel_packages && (
                          <p>套餐: {message.order_info.travel_packages.title} - {message.order_info.travel_packages.destination}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Enterprise order information */}
                    {message.enterprise_order_info && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-600">
                        <p>企业团建: {message.enterprise_order_info.departure_location} → {message.enterprise_order_info.destination_location}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;