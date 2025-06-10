import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { from, to, date, days, preferences } = await req.json()

    // Validate required parameters
    if (!from || !to || !date || !days) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: from, to, date, days' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate days is a positive number
    if (typeof days !== 'number' || days <= 0 || days > 30) {
      return new Response(
        JSON.stringify({ error: 'Days must be a number between 1 and 30' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate travel plan text
    const preferencesText = preferences && preferences.length > 0 
      ? `，偏好：${preferences.join('、')}` 
      : ''

    const planText = `
# ${from} → ${to} ${days}天旅行计划

## 行程概览
**出发地：** ${from}
**目的地：** ${to}
**出发日期：** ${date}
**行程天数：** ${days}天
**旅行偏好：** ${preferences?.join('、') || '无特殊偏好'}

## 详细行程安排

${generateDayByDayItinerary(from, to, days, preferences)}

## 旅行贴士
1. **交通建议：** 建议提前预订${from}到${to}的交通工具，可选择飞机、高铁或自驾
2. **住宿推荐：** 根据预算选择合适的酒店，建议预订市中心或景区附近的住宿
3. **美食推荐：** 不要错过当地特色美食和小吃
4. **购物建议：** 可以购买当地特产作为纪念品
5. **注意事项：** 关注天气变化，携带必要的衣物和用品

## 预算参考
- **交通费用：** 根据选择的交通方式而定
- **住宿费用：** 每晚200-800元不等
- **餐饮费用：** 每人每天100-300元
- **景点门票：** 根据具体景点而定
- **购物娱乐：** 根据个人需求而定

祝您旅途愉快！🎉
    `.trim()

    return new Response(
      JSON.stringify({ planText }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error generating travel plan:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function generateDayByDayItinerary(from: string, to: string, days: number, preferences: string[] = []): string {
  let itinerary = ''
  
  for (let day = 1; day <= days; day++) {
    itinerary += `### 第${day}天\n`
    
    if (day === 1) {
      itinerary += `**上午：** 从${from}出发前往${to}\n`
      itinerary += `**下午：** 抵达${to}，办理酒店入住，适应当地环境\n`
      itinerary += `**晚上：** 在酒店附近用餐，早休息调整状态\n\n`
    } else if (day === days && days > 1) {
      itinerary += `**上午：** 最后的购物时光，购买特产和纪念品\n`
      itinerary += `**下午：** 整理行李，前往机场/车站\n`
      itinerary += `**晚上：** 返回${from}\n\n`
    } else {
      // 中间的天数根据偏好生成不同的活动
      const activities = generateActivitiesForDay(day, preferences)
      itinerary += `**上午：** ${activities.morning}\n`
      itinerary += `**下午：** ${activities.afternoon}\n`
      itinerary += `**晚上：** ${activities.evening}\n\n`
    }
  }
  
  return itinerary
}

function generateActivitiesForDay(day: number, preferences: string[] = []): {
  morning: string
  afternoon: string
  evening: string
} {
  const hasFood = preferences.includes('美食探索')
  const hasCulture = preferences.includes('文化体验')
  const hasShopping = preferences.includes('购物')
  const hasNature = preferences.includes('自然风光')
  const hasHistory = preferences.includes('历史古迹')
  const hasThemePark = preferences.includes('主题乐园')
  const hasRelax = preferences.includes('休闲度假')
  const hasSports = preferences.includes('户外运动')

  const activities = {
    morning: '参观当地著名景点',
    afternoon: '继续游览，体验当地文化',
    evening: '品尝当地美食，休闲漫步'
  }

  // 根据偏好调整活动
  if (hasHistory) {
    activities.morning = '参观历史古迹和博物馆'
  } else if (hasNature) {
    activities.morning = '游览自然景观和公园'
  } else if (hasThemePark) {
    activities.morning = '前往主题乐园游玩'
  }

  if (hasCulture) {
    activities.afternoon = '体验当地文化活动和传统手工艺'
  } else if (hasShopping) {
    activities.afternoon = '逛街购物，探索当地商业区'
  } else if (hasSports) {
    activities.afternoon = '参与户外运动活动'
  }

  if (hasFood) {
    activities.evening = '寻找当地特色美食，品尝街头小吃'
  } else if (hasRelax) {
    activities.evening = '在酒店或度假村放松休息'
  }

  return activities
}