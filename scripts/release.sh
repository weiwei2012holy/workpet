#!/bin/bash
/**
 * @Author wei
 * @Date 2026-11-06
 * @Description WorkPet 一键自动化发版脚本，自动校验分支状态、创建 Git Tag 并推送触发 GitHub Actions 自动编译与 Release 发布
 **/

set -e

# 控制台彩色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}     WorkPet 一键自动化发版工具      ${NC}"
echo -e "${BLUE}======================================${NC}"

# 1. 确保在 Git 根目录下
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo -e "${RED}错误: 未在 Git 仓库目录中！${NC}"
    exit 1
fi
cd "$REPO_ROOT"

# 2. 检查当前分支
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo -e "当前分支: ${YELLOW}${CURRENT_BRANCH}${NC}"

if [ "$CURRENT_BRANCH" != "master" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}警告: 当前不是 master/main 主分支。${NC}"
    read -p "是否仍然继续从当前分支发版？(y/N): " CONFIRM_BRANCH
    if [[ "$CONFIRM_BRANCH" != "y" && "$CONFIRM_BRANCH" != "Y" ]]; then
        echo -e "${RED}发版已中止。${NC}"
        exit 1
    fi
fi

# 3. 检查是否有未提交的代码
if [ -n "$(git status --porcelain)" ]; then
    echo -e "\n${YELLOW}发现工作区存在未提交的变更：${NC}"
    git status -s
    echo ""
    read -p "是否先提交当前变更？(Y/n): " AUTO_COMMIT
    if [[ "$AUTO_COMMIT" == "n" || "$AUTO_COMMIT" == "N" ]]; then
        echo -e "${RED}存在未提交变更，发版中止。请先整理并提交代码后再发版。${NC}"
        exit 1
    else
        read -p "请输入提交信息 (Commit message): " COMMIT_MSG
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="chore: 准备发布新版本"
        fi
        git add -A
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}代码提交成功！${NC}"
    fi
fi

# 4. 获取最新 Git Tag 并计算推荐版本号（末位版本号 +1）
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LATEST_TAG" ]; then
    echo -e "\n当前仓库暂无历史 Tag (首次发版)"
    SUGGESTED_TAG="v0.1.0"
else
    echo -e "\n当前最新版本 Tag: ${YELLOW}${LATEST_TAG}${NC}"
    if [[ "$LATEST_TAG" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)(.*)$ ]]; then
        MAJOR="${BASH_REMATCH[1]}"
        MINOR="${BASH_REMATCH[2]}"
        PATCH="${BASH_REMATCH[3]}"
        NEXT_PATCH=$((PATCH + 1))
        SUGGESTED_TAG="v${MAJOR}.${MINOR}.${NEXT_PATCH}"
    else
        SUGGESTED_TAG="v0.1.0"
    fi
fi

# 5. 确定要发布的新版本号
NEW_TAG="$1"
if [ -z "$NEW_TAG" ]; then
    echo -e "${BLUE}请输入要发布的版本号 (默认: ${GREEN}${SUGGESTED_TAG}${BLUE}，直接按回车确认使用默认值)：${NC}"
    read -p "新版本号 [${SUGGESTED_TAG}]: " INPUT_TAG
    NEW_TAG="${INPUT_TAG:-$SUGGESTED_TAG}"
fi

# 校验版本号格式 (必须以 'v' 开头)
if [[ ! "$NEW_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+.*$ ]]; then
    echo -e "${RED}错误: 版本号格式不合法！必须以 'v' 开头并符合语义化版本，如 v0.1.0、v0.2.0。${NC}"
    exit 1
fi

# 检查该 tag 是否已存在
if git rev-parse "$NEW_TAG" >/dev/null 2>&1; then
    echo -e "${RED}错误: Tag ${NEW_TAG} 在本地已存在！请更换版本号。${NC}"
    exit 1
fi

# 6. 输入版本简要描述
read -p "请输入本次发版的简要说明 (按回车使用默认描述): " RELEASE_DESC
if [ -z "$RELEASE_DESC" ]; then
    RELEASE_DESC="Release ${NEW_TAG}"
fi

# 7. 确认发版
echo -e "\n${BLUE}================ 发版确认 ================${NC}"
echo -e "发布分支:  ${YELLOW}${CURRENT_BRANCH}${NC}"
echo -e "最新版本:  ${YELLOW}${LATEST_TAG}${NC}"
echo -e "目标版本:  ${GREEN}${NEW_TAG}${NC}"
echo -e "发布说明:  ${YELLOW}${RELEASE_DESC}${NC}"
echo -e "${BLUE}==========================================${NC}"

read -p "确认立即发布并推送到远程 GitHub 触发 CI 构建？(y/N): " FINAL_CONFIRM
if [[ "$FINAL_CONFIRM" != "y" && "$FINAL_CONFIRM" != "Y" ]]; then
    echo -e "${RED}操作已取消。${NC}"
    exit 0
fi

# 8. 自动同步更新代码中的版本号定义 (Version Bump)
echo -e "\n${BLUE}1. 同步更新代码中的版本定义 pkg/version/version.go -> ${GREEN}${NEW_TAG}${NC}..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/var Version = \".*\"/var Version = \"$NEW_TAG\"/" pkg/version/version.go
else
    sed -i "s/var Version = \".*\"/var Version = \"$NEW_TAG\"/" pkg/version/version.go
fi

# 检查是否有改动并自动提交
if [ -n "$(git status --porcelain pkg/version/version.go)" ]; then
    git add pkg/version/version.go
    git commit -m "chore(release): bump version to ${NEW_TAG}"
    echo -e "${GREEN}版本号已成功回写至源码并提交！${NC}"
fi

# 9. 推送代码到远程主分支
echo -e "\n${BLUE}2. 推送当前代码到远程 ${CURRENT_BRANCH}...${NC}"
git push origin "$CURRENT_BRANCH"

# 10. 创建并推送 Git Tag
echo -e "\n${BLUE}3. 创建本地标签 ${NEW_TAG}...${NC}"
git tag -a "$NEW_TAG" -m "$RELEASE_DESC"

echo -e "\n${BLUE}4. 推送标签 ${NEW_TAG} 到远程 GitHub...${NC}"
git push origin "$NEW_TAG"

echo -e "\n${GREEN}==========================================${NC}"
echo -e "${GREEN}🎉 成功推送版本 Tag: ${NEW_TAG}！${NC}"
echo -e "${GREEN}GitHub Actions 正在自动打包并发布 Release！${NC}"
echo -e "构建进度查看: ${BLUE}https://github.com/weiwei2012holy/workpet/actions${NC}"
echo -e "Releases 页面: ${BLUE}https://github.com/weiwei2012holy/workpet/releases${NC}"
echo -e "${GREEN}==========================================${NC}"
