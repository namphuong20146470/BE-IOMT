-- Sample specification fields for medical devices
INSERT INTO specifications (device_model_id, field_name, field_name_vi, value, unit, description, display_order) VALUES

-- Điện áp và nguồn điện
('device_model_uuid_here', 'voltage', 'Điện áp', '220', 'V', 'Điện áp hoạt động tiêu chuẩn', 1),
('device_model_uuid_here', 'power_consumption', 'Công suất tiêu thụ', '150', 'W', 'Công suất tiêu thụ tối đa', 2),
('device_model_uuid_here', 'frequency', 'Tần số', '50', 'Hz', 'Tần số điện áp hoạt động', 3),

-- Kích thước và trọng lượng  
('device_model_uuid_here', 'dimensions', 'Kích thước', '450 x 350 x 200', 'mm', 'Chiều dài x Rộng x Cao', 4),
('device_model_uuid_here', 'weight', 'Trọng lượng', '12.5', 'kg', 'Trọng lượng thiết bị', 5),

-- Thông số kỹ thuật y tế
('device_model_uuid_here', 'maximum_pressure', 'Áp suất tối đa', '300', 'mmHg', 'Áp suất tối đa có thể đo được', 6),
('device_model_uuid_here', 'temperature_range', 'Phạm vi nhiệt độ', '5 - 40', '°C', 'Phạm vi nhiệt độ hoạt động', 7),
('device_model_uuid_here', 'accuracy', 'Độ chính xác', '±2', '%', 'Độ chính xác đo lường', 8),
('device_model_uuid_here', 'resolution', 'Độ phân giải', '0.1', 'mmHg', 'Độ phân giải nhỏ nhất', 9),

-- Màn hình và giao diện
('device_model_uuid_here', 'display_size', 'Kích thước màn hình', '15', 'inch', 'Kích thước màn hình hiển thị', 10),
('device_model_uuid_here', 'display_resolution', 'Độ phân giải màn hình', '1920x1080', 'pixels', 'Độ phân giải màn hình', 11),

-- Kết nối và giao tiếp
('device_model_uuid_here', 'connectivity', 'Kết nối', 'WiFi, Ethernet, USB', '', 'Các phương thức kết nối', 12),
('device_model_uuid_here', 'operating_system', 'Hệ điều hành', 'Android 11', '', 'Hệ điều hành của thiết bị', 13),

-- Tiêu chuẩn và chứng nhận
('device_model_uuid_here', 'certification', 'Chứng nhận', 'FDA, CE, ISO 13485', '', 'Các chứng nhận y tế', 14),
('device_model_uuid_here', 'ip_rating', 'Chuẩn chống nước', 'IPX4', '', 'Mức độ chống nước bụi', 15),

-- Thông số môi trường
('device_model_uuid_here', 'humidity_range', 'Độ ẩm hoạt động', '30 - 85', '%RH', 'Phạm vi độ ẩm hoạt động', 16),
('device_model_uuid_here', 'storage_temperature', 'Nhiệt độ bảo quản', '-20 - 60', '°C', 'Phạm vi nhiệt độ bảo quản', 17);

-- Common medical device specification templates
CREATE TEMP TABLE spec_templates AS VALUES
  ('voltage', 'Điện áp', 'V', 'Điện áp hoạt động của thiết bị'),
  ('power', 'Công suất', 'W', 'Công suất tiêu thụ điện'),
  ('current', 'Dòng điện', 'A', 'Dòng điện hoạt động'),
  ('frequency', 'Tần số', 'Hz', 'Tần số điện áp'),
  ('dimensions', 'Kích thước', 'mm', 'Kích thước thiết bị (D x R x C)'),
  ('weight', 'Trọng lượng', 'kg', 'Trọng lượng thiết bị'),
  ('display_size', 'Kích thước màn hình', 'inch', 'Kích thước đường chéo màn hình'),
  ('resolution', 'Độ phân giải', 'pixels', 'Độ phân giải hiển thị'),
  ('pressure_range', 'Phạm vi áp suất', 'mmHg', 'Phạm vi đo áp suất'),
  ('temperature_range', 'Phạm vi nhiệt độ', '°C', 'Phạm vi nhiệt độ hoạt động'),
  ('humidity_range', 'Độ ẩm', '%RH', 'Phạm vi độ ẩm hoạt động'),
  ('accuracy', 'Độ chính xác', '%', 'Độ chính xác đo lường'),
  ('sensitivity', 'Độ nhạy', '', 'Độ nhạy của cảm biến'),
  ('response_time', 'Thời gian phản hồi', 'ms', 'Thời gian phản hồi của thiết bị'),
  ('battery_life', 'Thời lượng pin', 'hours', 'Thời gian hoạt động bằng pin'),
  ('memory_capacity', 'Dung lượng bộ nhớ', 'GB', 'Dung lượng lưu trữ'),
  ('connectivity', 'Kết nối', '', 'Các phương thức kết nối'),
  ('certification', 'Chứng nhận', '', 'Chứng nhận y tế và tiêu chuẩn'),
  ('warranty', 'Bảo hành', 'years', 'Thời gian bảo hành'),
  ('ip_rating', 'Chống nước bụi', '', 'Mức độ chống nước và bụi');