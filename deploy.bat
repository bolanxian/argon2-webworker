cd dist

git init
git add -A
git commit -m 'deploy'

git push -f --progress "https://github.com/bolanxian/argon2-webworker.git" master:gh-pages