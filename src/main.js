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
function analyzeSalesData(options) {
    const { sellers, products, purchase_records } = options;
  
    // Валидация входных данных
    if (!sellers || !products || !purchase_records) {
      throw new Error('Не переданы обязательные данные');
    }
    if (sellers.length === 0 || products.length === 0 || purchase_records.length === 0) {
      throw new Error('Один из массивов пуст');
    }
  
    // Создаем Map для быстрого доступа к продуктам по SKU
    const productMap = new Map();
    products.forEach(product => {
      productMap.set(product.sku, product);
    });
  
    // Создаем Map для быстрого доступа к продавцам по ID
    const sellerMap = new Map();
    sellers.forEach(seller => {
      sellerMap.set(seller.seller_id, {
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        productSales: new Map(), // Для подсчета топ товаров
        bonus: 0
      });
    });
  
    // Обрабатываем записи покупок
    purchase_records.forEach(record => {
      const seller = sellerMap.get(record.seller_id);
      if (!seller) return;
  
      const product = productMap.get(record.sku);
      if (!product) return;
  
      const price = record.price || product.price;
      const cost = product.cost;
      const quantity = record.quantity;
      
      // Выручка
      const revenue = price * quantity;
      seller.revenue += revenue;
      
      // Прибыль
      const profit = (price - cost) * quantity;
      seller.profit += profit;
      
      // Количество продаж
      seller.sales_count += quantity;
      
      // Подсчет продаж по товарам для топ-10
      if (!seller.productSales.has(record.sku)) {
        seller.productSales.set(record.sku, 0);
      }
      seller.productSales.set(record.sku, seller.productSales.get(record.sku) + quantity);
    });
  
    // Формируем результат и рассчитываем бонусы
    const result = Array.from(sellerMap.values()).map(seller => {
      // Сортируем товары по количеству продаж и берем топ-10
      const topProducts = Array.from(seller.productSales.entries())
        .map(([sku, quantity]) => ({ sku, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
  
      // Рассчитываем бонус (15% от прибыли)
      seller.bonus = seller.profit * 0.15;
  
      return {
        seller_id: seller.seller_id,
        name: seller.name, // Важно: используем настоящее имя из sellers
        revenue: parseFloat(seller.revenue.toFixed(2)),
        profit: parseFloat(seller.profit.toFixed(2)),
        sales_count: seller.sales_count,
        top_products: topProducts,
        bonus: parseFloat(seller.bonus.toFixed(2))
      };
    });
  
    // Сортируем по выручке (убыванию)
    return result.sort((a, b) => b.revenue - a.revenue);
  }