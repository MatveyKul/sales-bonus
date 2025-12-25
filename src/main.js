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
    
    // Получаем прибыль продавца
    const { profit } = seller;
    
    // Рассчитываем денежный бонус (а не процент)
    if (index === 0) {
        return profit * 0.15; // 15% от прибыли
    } else if (index === 1 || index === 2) {
        return profit * 0.10; // 10% от прибыли
    } else if (index === total - 1) {
        return 0; // последнее место = 0
    } else {
        return profit * 0.05; // 5% от прибыли
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
    if (!data
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.purchase_records)
        || data.sellers.length === 0
        || data.products.length === 0
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    // @TODO: Проверка наличия опций
    try {
        const { calculateRevenue, calculateBonus } = options;
        
        if (!calculateRevenue || !calculateBonus) {
            throw new Error('Отсутствуют обязательные функции в опциях');
        }
        
        if (typeof calculateRevenue !== 'function') {
            throw new Error('calculateRevenue должна быть функцией');
        }
        
        if (typeof calculateBonus !== 'function') {
            throw new Error('calculateBonus должна быть функцией');
        }
    } catch (error) {
        throw new Error('Некорректные опции: ' + error.message);
    }

    const { calculateRevenue, calculateBonus } = options;

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        seller_id: seller.id,
        // Пробуем разные варианты поля с именем
        name: seller.name || seller.full_name || seller.seller_name || String(seller.id),
        sales_count: 0,
        revenue: 0,
        profit: 0,
        bonus: 0,
        cost_total: 0,
        products_sold: {}
    }));

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(
        sellerStats.map(stat => [stat.seller_id, stat])
    );

    const productIndex = Object.fromEntries(
        data.products.map(product => [product.id, product])
    );

    // @TODO: Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        if (!seller) {
            console.warn(`Продавец с id ${record.seller_id} не найден`);
            return;
        }
        
        seller.sales_count += 1;
        
        // Инициализируем переменные для этого чека
        let recordRevenue = 0;
        let recordCost = 0;

        // Обрабатываем каждый товар в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            // Расчет себестоимости
            const cost = product && product.purchase_price != null 
                ? product.purchase_price * item.quantity 
                : 0;
            recordCost += cost;
            
            // Расчет выручки от товара
            const itemRevenue = calculateRevenue(item, product);
            recordRevenue += itemRevenue;
            
            // Учет проданных товаров
            if (seller.products_sold[item.sku] === undefined) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
        
        // Обновляем общие показатели продавца
        if (record.total_amount != null) {
            // Если есть total_amount, используем его для revenue
            seller.revenue += record.total_amount;
        } else {
            // Иначе используем рассчитанную выручку
            seller.revenue += recordRevenue;
        }
        
        seller.cost_total += recordCost;
        // Прибыль = Выручка - Себестоимость
        seller.profit = seller.revenue - seller.cost_total;
    });

    // @TODO: Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
    sellerStats.forEach((seller, index) => {
        // Рассчитываем денежный бонус
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        
        // Формирование топ-10 товаров
        const productsArray = Object.entries(seller.products_sold)
            .map(([product_id, quantity]) => ({
                sku: product_id,
                quantity
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        
        seller.top_products = productsArray;
    });

    // @TODO: Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}