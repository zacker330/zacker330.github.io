# 博客发布与迁移

正式地址始终为 **https://showme.codes/**。Hugo 构建产物由 GitHub Pages 托管，Cloudflare 只保留 DNS。文章路径、canonical、RSS 和 sitemap 都沿用原地址。

## 本地构建与发布

使用 Hugo **0.162.1 extended** 和 Node.js 20 或更高版本：

```sh
hugo server -D
bash scripts/build-pages.sh https://showme.codes/ public
node --test scripts/verify-site.test.mjs
```

工作流 `.github/workflows/pages.yml` 在 PR 中构建验证，在 `master` 推送或手动触发时部署。构建失败不会发布；`public/` 不提交到 Git。只有已提交的文章会在 Actions 中构建。

工作流读取 Pages 的域名配置。绑定 `showme.codes` 后生成允许索引的正式产物；未绑定域名时生成 `zacker330.github.io` 预览产物，所有 HTML 都带 `noindex`，robots.txt 禁止抓取。其他域名或带仓库前缀的地址会被拒绝。

`scripts/baselines/published-urls.json` 保存迁移前现网 sitemap 的 253 个 URL。每次构建检查这些 URL 仍存在，canonical 与 sitemap 一致，RSS、Open Graph 和历史 aliases 指向正确域名。新增文章不需要修改基线；有意删除既有页面时，需要明确处理旧 URL 后再审查基线变更。

## 首次迁移

1. 保存 Cloudflare 原 DNS 记录的类型、真实目标、代理状态和 TTL，以及 Pages 项目的自定义域名、构建设置、最近成功部署。不要用公网查到的 Cloudflare 代理 IP 代替原 DNS 配置。
2. 保存现网 sitemap、robots.txt 和代表性文章及历史跳转的响应，确保部署对应同一提交。存在无法在 GitHub Pages 保持的 HTTP 重定向或动态功能时，先解决兼容问题再切流。
3. 通过 GitHub REST API 将 Pages 发布来源设为 Actions。使用对本仓库有管理权限的 GitHub 身份：

   ```sh
   gh api --method PUT repos/zacker330/zacker330.github.io/pages -f build_type=workflow
   ```

4. 发布并检查 `https://zacker330.github.io/` 预览站。预览只用于验证，不作为正式访问入口。通过 GitHub 账号的域名验证流程取得并设置 TXT，永久保留该验证记录。
5. 在切换窗口开始时绑定原域名并重新运行工作流：

   ```sh
   gh api --method PUT repos/zacker330/zacker330.github.io/pages -f cname=showme.codes
   ```

6. 确认正式产物部署成功后，将下表中的博客 DNS 记录全部设为 **DNS only／灰云**，TTL 为 300 秒。替换原根域的冲突记录，保留邮件、其他子域和验证记录。Cloudflare nameserver 不变，也不要对整个 zone 执行 Pause Cloudflare。

| 名称 | 类型 | 目标 |
| --- | --- | --- |
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `@` | AAAA | `2606:50c0:8000::153` |
| `@` | AAAA | `2606:50c0:8001::153` |
| `@` | AAAA | `2606:50c0:8002::153` |
| `@` | AAAA | `2606:50c0:8003::153` |
| `www` | CNAME | `zacker330.github.io` |

7. 等待 GitHub Pages 为域名签发证书，再启用 HTTPS：

   ```sh
   gh api repos/zacker330/zacker330.github.io/pages
   gh api --method PUT repos/zacker330/zacker330.github.io/pages -F https_enforced=true
   ```

首次 HTTPS 配置预留一小时窗口。若存在限制性 CAA，必须允许 GitHub 使用的 Let's Encrypt 签发；没有 CAA 时无需添加。

## 上线验收与回滚

- 比较切换前后 sitemap 的完整 URL 集合。逐个检查基线 URL 返回成功、最终 URL 不变，canonical 与原地址一致；同时核对旧 aliases 的实际跳转行为。
- 检查首页、中英文栏目、About、标签、分页、搜索、RSS、图片、CSS、JS、robots.txt、ads.txt 和 404。确认正式页面没有意外的 `noindex`。
- 检查公共 DNS 的 IPv4 和 IPv6 都指向 GitHub，Cloudflare 博客记录为灰云；直接请求 GitHub Pages，确认有效 TLS、HTTP 跳转 HTTPS、`www` 跳转根域并保留文章路径。
- 在常用访问地区检查可达性与加载体验，用 Search Console 检查代表性页面，不提交地址变更。验证后续一次 `master` 自动发布。
- 验收后停用旧 Cloudflare 项目的自动部署，保留部署和自定义域名绑定七天。确认稳定后再解除绑定并删除旧托管项目，继续保留 DNS zone。

若新增 404、最终 URL 改变、证书在预留窗口内仍未就绪，或访问体验不可接受，恢复原 DNS 目标与代理状态并暂停 GitHub 发布。等待 DNS 缓存过期，再确认旧站恢复。保留回滚记录，不删除已备份的旧部署。

参考：[Hugo 部署到 GitHub Pages](https://gohugo.io/host-and-deploy/deploy-to-github-pages/)、[GitHub 自定义域名与 DNS](https://docs.github.com/github/working-with-github-pages/managing-a-custom-domain-for-your-github-pages-site)、[GitHub Pages HTTPS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages)。
