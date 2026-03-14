# 重构文档索引

本目录包含系统重构的技术文档，记录架构演进和决策过程。

##  文档列表

### Customer Tags 重构 (2026-01)
- **[CUSTOMER_TAGS_REFACTORING_PLAN.md](./CUSTOMER_TAGS_REFACTORING_PLAN.md)** - 重构架构设计
  - 从 1,984 行单体组件重构为模块化架构
  - Controller Pattern + 组件化设计
  - 90% 代码减少

- **[CUSTOMER_TAGS_REFACTORING_COMPLETE.md](./CUSTOMER_TAGS_REFACTORING_COMPLETE.md)** - 完成报告
  - 实施细节和最终状态
  - 性能指标和测试覆盖率
  - 经验总结和最佳实践

##  重构原则

1. **可维护性优先** - 模块化、组件化、职责分离
2. **类型安全** - 100% TypeScript，零 ESLint 错误
3. **测试驱动** - 完整的测试覆盖率
4. **文档先行** - 架构决策记录 (ADR)

##  如何使用这些文档

- **新成员入职** - 了解系统架构演进
- **技术决策** - 参考历史重构经验
- **代码审查** - 检查是否符合既定模式
- **技术分享** - 团队学习和知识传承
