-- Create mechanics table
CREATE TABLE IF NOT EXISTS mechanics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    specialty VARCHAR(255) NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample mechanics (modify names as needed)
INSERT INTO mechanics (name, phone, specialty) VALUES
('გიორგი კვარაცხელია', '', 'ძარის რემონტი'),
('დავით მელაძე', '', 'მექანიკა'),
('ლევან ბერიძე', '', 'შეღებვა'),
('ნიკა გელაშვილი', '', 'ელექტრონიკა');
