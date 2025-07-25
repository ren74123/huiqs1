-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "admin_message_logs_policy_v8" ON message_logs;
DROP POLICY IF EXISTS "agent_message_logs_policy_v8" ON message_logs;
DROP POLICY IF EXISTS "user_message_logs_policy_v8" ON message_logs;

-- Enable RLS
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- Create policies with unique names
CREATE POLICY "admin_message_logs_policy_v9"
ON message_logs
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_role = 'admin'
  )
);

CREATE POLICY "agent_message_logs_policy_v9"
ON message_logs
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN travel_packages tp ON o.package_id = tp.id
    WHERE o.id = message_logs.order_id
    AND tp.agent_id = auth.uid()
  )
);

CREATE POLICY "user_message_logs_policy_v9"
ON message_logs
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = message_logs.order_id
    AND o.user_id = auth.uid()
  )
);

-- Drop old function and trigger
DROP FUNCTION IF EXISTS sync_order_status_v7 CASCADE;

-- Create new function
CREATE OR REPLACE FUNCTION sync_order_status_v9()
RETURNS trigger AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    -- Insert message log for status change
    INSERT INTO message_logs (
      order_id,
      from_role,
      message
    ) VALUES (
      NEW.id,
      'agent',
      CASE 
        WHEN NEW.status = 'contacted' THEN '订单状态已更新为已联系'
        WHEN NEW.status = 'rejected' THEN '订单已被拒绝'
        ELSE '订单状态已更新为待联系'
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger
CREATE TRIGGER sync_order_status_trigger_v9
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_status_v9();