/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount = 0, sale_price, quantity } = purchase;
    
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
    
    return revenueWithDiscount;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (total <= 0) 
        return 0;
    if (index < 0 || index >= total) 
        return 0;
    
    const { profit } = seller;
    
    if (index === 0) {
        return Math.round(profit * 0.15 * 100) / 100;
    } else if (index === 1 || index === 2) {
        return Math.round(profit * 0.10 * 100) / 100;
    } else if (index === total - 1) {
        return 0;
    } else {
        return Math.round(profit * 0.05 * 100) / 100;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
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

    // Проверка наличия опций
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

    // Подготовка промежуточных данных
    const sellerStats = data.sellers.map(seller => ({
        seller_id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        sales_count: 0,
        revenue: 0,
        profit: 0,
        bonus: 0,
        products_sold: {}
    }));

    // Индексация для быстрого доступа
    const sellerIndex = Object.fromEntries(
        sellerStats.map(stat => [stat.seller_id, stat])
    );

    const productIndex = Object.fromEntries(
        data.products.map(product => [product.sku, product])
    );

    // Обработка всех записей о покупках
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        if (!seller) {
            console.warn(`Продавец с id ${record.seller_id} не найден`);
            return;
        }
        
        // Увеличить количество продаж на 1
        seller.sales_count += 1;
        
        seller.revenue += record.total_amount;

        // Расчёт прибыли для каждого товара в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            if (!product) {
                console.warn(`Товар с sku ${item.sku} не найден`);
                return;
            }
            
            // Посчитать себестоимость товара
            const cost = product.purchase_price * item.quantity;
            
            // Посчитать выручку с учётом скидки через функцию calculateRevenue
            const itemRevenue = calculateRevenue(item, product);
            
            // Прибыль: выручка минус себестоимость
            seller.profit += (itemRevenue - cost);
            
            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Сортировка продавцов по прибыли (убывание)
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Назначение премий на основе ранжирование
    sellerStats.forEach((seller, index) => {
        // Рассчитываем бонус
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        
        // Формирование топ-10 товаров
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({
                sku,
                quantity
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: parseFloat(seller.revenue.toFixed(2)),
        profit: parseFloat(seller.profit.toFixed(2)),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: parseFloat(seller.bonus.toFixed(2))
    }));
}