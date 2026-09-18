package store

import (
	"context"
	"fmt"
)

func (s *Store) Backup(ctx context.Context, destination string) error {
	if destination == "" {
		return fmt.Errorf("备份路径不能为空")
	}
	if _, err := s.db.ExecContext(ctx, `VACUUM INTO ?`, destination); err != nil {
		return fmt.Errorf("创建数据库备份失败: %w", err)
	}
	return nil
}
