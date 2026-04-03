using Microsoft.Data.SqlClient;

namespace GITP.API.Data;

public interface IDbConnectionFactory
{
    SqlConnection CreateConnection();
}

public class SqlConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public SqlConnectionFactory(IConfiguration config)
        => _connectionString = config.GetConnectionString("DefaultConnection")
           ?? throw new InvalidOperationException("DefaultConnection not configured");

    public SqlConnection CreateConnection() => new SqlConnection(_connectionString);
}
