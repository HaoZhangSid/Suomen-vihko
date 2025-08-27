document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('days-nav');
    const contentArea = document.getElementById('content-area');
    let allData = [];

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            allData = data;
            createNavButtons();
            // 默认显示第一天的内容
            if (allData.length > 0) {
                displayDayContent(0);
                nav.querySelector('button')?.classList.add('active');
            }
        })
        .catch(error => {
            console.error('加载笔记数据时出错:', error);
            contentArea.innerHTML = '<p>加载笔记失败，请检查 data.json 文件是否存在或格式是否正确。</p>';
        });

    function createNavButtons() {
        allData.forEach((dayData, index) => {
            const button = document.createElement('button');
            button.textContent = `第 ${index + 1} 天`;
            button.dataset.dayIndex = index;
            button.addEventListener('click', (event) => {
                // 移除所有按钮的 active class
                nav.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                // 给当前点击的按钮添加 active class
                event.target.classList.add('active');
                displayDayContent(index);
            });
            nav.appendChild(button);
        });
    }

    function displayDayContent(index) {
        contentArea.innerHTML = ''; // 清空现有内容
        const dayData = allData[index];
        if (!dayData) return;

        const dayTitle = document.createElement('h2');
        dayTitle.textContent = dayData.day;
        contentArea.appendChild(dayTitle);

        dayData.entries.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'entry';

            const finnishP = document.createElement('p');
            finnishP.className = 'finnish';
            finnishP.textContent = entry.finnish;

            const chineseP = document.createElement('p');
            chineseP.className = 'chinese';
            chineseP.textContent = entry.chinese;

            entryDiv.appendChild(finnishP);
            entryDiv.appendChild(chineseP);
            contentArea.appendChild(entryDiv);
        });
    }
});
