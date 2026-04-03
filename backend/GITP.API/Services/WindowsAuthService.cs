using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace GITP.API.Services;

/// <summary>
/// Helper service for validating Azure AD ID tokens using OIDC metadata discovery.
/// </summary>
public class WindowsAuthService
{
    private readonly ILogger<WindowsAuthService> _logger;

    // Cache OIDC configs to avoid repeated HTTP calls; keyed by tenantId
    private readonly Dictionary<string, ConfigurationManager<OpenIdConnectConfiguration>> _configManagers = new();
    private readonly SemaphoreSlim _lock = new(1, 1);

    public WindowsAuthService(ILogger<WindowsAuthService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Validates an Azure AD ID token (received from MSAL on the frontend).
    /// Returns the ClaimsPrincipal on success; throws SecurityTokenException on failure.
    /// </summary>
    public async Task<ClaimsPrincipal> ValidateAzureAdTokenAsync(
        string idToken,
        string tenantId,
        string clientId)
    {
        var configManager = await GetConfigManagerAsync(tenantId);
        var oidcConfig    = await configManager.GetConfigurationAsync(CancellationToken.None);

        var validIssuers = new[]
        {
            $"https://login.microsoftonline.com/{tenantId}/v2.0",
            $"https://sts.windows.net/{tenantId}/"
        };

        var validationParams = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys        = oidcConfig.SigningKeys,
            ValidateIssuer           = true,
            ValidIssuers             = validIssuers,
            ValidateAudience         = true,
            ValidAudiences           = new[] { clientId },
            ValidateLifetime         = true,
            ClockSkew                = TimeSpan.FromMinutes(5)
        };

        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(idToken, validationParams, out _);
            return principal;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Azure AD token validation error: {Message}", ex.Message);
            throw new SecurityTokenException($"Azure AD 驗證失敗: {ex.Message}", ex);
        }
    }

    private async Task<ConfigurationManager<OpenIdConnectConfiguration>> GetConfigManagerAsync(string tenantId)
    {
        await _lock.WaitAsync();
        try
        {
            if (!_configManagers.TryGetValue(tenantId, out var manager))
            {
                var metadataAddress =
                    $"https://login.microsoftonline.com/{tenantId}/v2.0/.well-known/openid-configuration";
                manager = new ConfigurationManager<OpenIdConnectConfiguration>(
                    metadataAddress,
                    new OpenIdConnectConfigurationRetriever(),
                    new HttpDocumentRetriever { RequireHttps = true });
                _configManagers[tenantId] = manager;
            }
            return manager;
        }
        finally
        {
            _lock.Release();
        }
    }
}
