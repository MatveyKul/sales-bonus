/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // @TODO: Расчет выручки от операции
    const { discount = 0, sale_price, quantity } = purchase;
    
    // Добавлены проверки для надежности
    if (sale_price == null || quantity == null) {
        throw new Error('Некорректные данные покупки');
    }
    
    if (sale_price < 0 || quantity <= 0) {
        throw new Error('Цена или количество некорректны');
    }
    
    if (discount < 0 || discount > 100) {
        throw new Error('Скидка должна быть от 0 до 100%');
    }
    
    // В ваших данных discount уже в процентах (7.68), а не целое число (7)
    // Значит нужно делить на 100: 7.68 → 0.0768
    const decimalDiscount = discount / 100;
    const fullPrice = sale_price * quantity;
    const revenueWithDiscount = fullPrice * (1 - decimalDiscount);
    
    return Math.round(revenueWithDiscount * 100) / 100;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    if (total <= 0) 
        return 0;
    if (index < 0 || index >= total) 
        return 0;
    if (index === 0) {
        return 0.15;
    } else if (index === 1 || index === 2) {
        return 0.10;
    } else if (index === total - 1) {
        return 0; // последнее место = 0%
    } else {
        return 0.05; // все остальные = 5%
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {

    // @TODO: Проверка входных данных
    // ИЗМЕНЕНО: purchases → purchase_records для ваших данных
    if (!data
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.purchase_records)  // ← ИЗМЕНЕНО: purchases → purchase_records
        || data.sellers.length === 0
        || data.purchase_records.length === 0     // ← ИЗМЕНЕНО: purchases → purchase_records
    ) {
        throw new Error('Некорректные входные данные');
    }

    // @TODO: Проверка наличия опций
    try {
        // Деструктуризация проверит, что options - объект
        const { calculateRevenue, calculateBonus } = options;
        
        // Проверяем, что функции определены
        if (!calculateRevenue || !calculateBonus) {
            throw new Error('Отсутствуют обязательные функции в опциях');
        }
        
        // Опционально: проверяем, что это действительно функции
        if (typeof calculateRevenue !== 'function') {
            throw new Error('calculateRevenue должна быть функцией');
        }
        
        if (typeof calculateBonus !== 'function') {
            throw new Error('calculateBonus должна быть функцией');
        }
    } catch (error) {
        // Если деструктуризация не удалась (options не объект)
        throw new Error('Некорректные опции: ' + error.message);
    }

    const { calculateRevenue, calculateBonus } = options;

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        seller_id: seller.id,
        name: seller.name || 'Неизвестный продавец',
        sales_count: 0,
        revenue: 0,
        profit: 0,
        bonus: 0,
        cost_total: 0,  // общая себестоимость
        // Поле для хранения продуктов (для top_products)
        products_sold: {} // ключ: product_id, значение: количество
    }));

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(
        sellerStats.map(stat => [stat.seller_id, stat])
    );

    const productIndex = Object.fromEntries(
        data.products.map(product => [product.id, product])
    );

    // @TODO: Расчет выручки и прибыли для каждого продавца
    // ИЗМЕНЕНО: purchases → purchase_records для ваших данных
    data.purchase_records.forEach(record => { // Чек 
        const seller = sellerIndex[record.seller_id]; // Продавец
        
        if (!seller) {
            console.warn(`Продавец с id ${record.seller_id} не найден`);
            return;
        }
        
        seller.sales_count += 1; // Увеличить количество продаж 
        
        // В ваших данных может не быть total_amount
        // Проверяем если есть receipt_id и другие поля, но нет total_amount
        if (record.total_amount != null) {
            seller.revenue += record.total_amount;
        } // Увеличить общую сумму выручки всех продаж

        let totalCost = 0;
        let totalProfit = 0;

        // Расчёт прибыли для каждого товара
        record.items.forEach(item => {
            const product = productIndex[item.sku]; // Товар
            
            // Посчитать себестоимость (cost) товара как product.purchase_price, умноженную на количество товаров из чека
            const cost = product && product.purchase_price != null 
                ? product.purchase_price * item.quantity 
                : 0;
            totalCost += cost;
            
            // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
            const itemRevenue = calculateRevenue(item, product);
            
            // Посчитать прибыль: выручка минус себестоимость
            const itemProfit = itemRevenue - cost;
            totalProfit += itemProfit;
            // Увеличить общую накопленную прибыль (profit) у продавца  

            // Учёт количества проданных товаров
            if (seller.products_sold[item.sku] === undefined) {
                seller.products_sold[item.sku] = 0;
            }
            // По артикулу товара увеличить его проданное количество у продавца
            seller.products_sold[item.sku] += item.quantity;
        });
        
        // Увеличить общую накопленную себестоимость и прибыль у продавца
        seller.cost_total += totalCost;
        seller.profit += totalProfit;
        
        // Если total_amount не был предоставлен, пересчитываем revenue из товаров
        // В ваших данных скорее всего нет total_amount, поэтому всегда считаем из items
        let calculatedRevenue = 0;
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            calculatedRevenue += calculateRevenue(item, product);
        });
        seller.revenue += calculatedRevenue;
    });

    // @TODO: Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        
        // Формирование топ-10 товаров
        const productsArray = Object.entries(seller.products_sold)
            .map(([product_id, quantity]) => ({
                product_id,
                quantity
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        
        seller.top_products = productsArray;
    });

    // @TODO: Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.seller_id,  // Строка, идентификатор продавца
        name: seller.name,            // Строка, имя продавца
        revenue: +seller.revenue.toFixed(2),  // Число с двумя знаками после точки, выручка продавца
        profit: +seller.profit.toFixed(2),    // Число с двумя знаками после точки, прибыль продавца
        sales_count: seller.sales_count,      // Целое число, количество продаж продавца
        top_products: seller.top_products,    // Массив объектов вида: { "sku": "SKU_008","quantity": 10}, топ-10 товаров продавца
        bonus: +seller.bonus.toFixed(2)       // Число с двумя знаками после точки, бонус продавца
    }));
}